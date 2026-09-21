import { randomUUID } from 'node:crypto';

import { and, asc, eq, gt, isNull, lt, sql } from 'drizzle-orm';

import type { Database, Transaction } from '../../db/client.js';
import { otpChallenges } from '../../db/schema/index.js';
import { addSeconds, type Clock } from '../../lib/clock.js';
import { hmacSha256Hex, randomNumericCode, safeEqual } from '../../lib/crypto.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import type { SmsProvider } from '../sms/index.js';
import type { AuthPolicy } from './auth.policy.js';

export interface OtpRequestResult {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface VerifiedChallenge {
  id: string;
  phoneE164: string;
}

export interface OtpServiceDeps {
  db: Database;
  sms: SmsProvider;
  clock: Clock;
  policy: AuthPolicy;
  /** Server secret that keys the code hash. */
  hmacSecret: string;
}

const HOUR_SECONDS = 60 * 60;

/** Same answer for a wrong, expired, unknown, used or replaced code, so nothing is revealed. */
const invalidOtp = () =>
  new AppError(401, ErrorCode.InvalidOtp, 'The code is invalid or has expired.');

const attemptsExceeded = () =>
  new AppError(
    429,
    ErrorCode.OtpAttemptsExceeded,
    'Too many incorrect attempts. Request a new code.',
  );

export function createOtpService({ db, sms, clock, policy, hmacSecret }: OtpServiceDeps) {
  // The hash is bound to the challenge id, so a code cannot be replayed against
  // another challenge, and it is keyed, so it cannot be brute-forced from a DB leak alone.
  const hashCode = (challengeId: string, code: string) =>
    hmacSha256Hex(hmacSecret, `${challengeId}:${code}`);

  /**
   * Creates a challenge for `phoneE164` and sends the code.
   *
   * The response is identical whether or not the phone belongs to an account.
   * Requests for the same phone are serialised with an advisory lock so the
   * cooldown and hourly cap cannot be bypassed by racing requests.
   */
  async function requestOtp(phoneE164: string): Promise<OtpRequestResult> {
    const now = clock();

    const { id, code } = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp-request:${phoneE164}`}))`);

      const hourAgo = addSeconds(now, -HOUR_SECONDS);
      const recent = await tx
        .select({ createdAt: otpChallenges.createdAt })
        .from(otpChallenges)
        .where(and(eq(otpChallenges.phoneE164, phoneE164), gt(otpChallenges.createdAt, hourAgo)))
        .orderBy(asc(otpChallenges.createdAt));

      const newest = recent.at(-1);
      if (newest) {
        const elapsedMs = now.getTime() - newest.createdAt.getTime();
        const remainingSeconds = Math.ceil(
          (policy.otpResendCooldownSeconds * 1000 - elapsedMs) / 1000,
        );
        if (remainingSeconds > 0) {
          throw new AppError(
            429,
            ErrorCode.OtpResendCooldown,
            'Please wait before requesting another code.',
            { headers: { 'Retry-After': String(remainingSeconds) } },
          );
        }
      }

      if (recent.length >= policy.otpMaxRequestsPerPhonePerHour) {
        // The window frees a slot when the request `max` positions from the end ages out.
        const blocking = recent[recent.length - policy.otpMaxRequestsPerPhonePerHour];
        const retryAfter = blocking
          ? Math.max(
              1,
              Math.ceil(
                (blocking.createdAt.getTime() + HOUR_SECONDS * 1000 - now.getTime()) / 1000,
              ),
            )
          : HOUR_SECONDS;
        throw new AppError(
          429,
          ErrorCode.RateLimited,
          'Too many code requests. Please try again later.',
          { headers: { 'Retry-After': String(retryAfter) } },
        );
      }

      // Only one live code per phone: a new request replaces the previous one.
      await tx
        .update(otpChallenges)
        .set({ invalidatedAt: now })
        .where(
          and(
            eq(otpChallenges.phoneE164, phoneE164),
            isNull(otpChallenges.consumedAt),
            isNull(otpChallenges.invalidatedAt),
            gt(otpChallenges.expiresAt, now),
          ),
        );

      const challengeId = randomUUID();
      const newCode = randomNumericCode(policy.otpLength);
      await tx.insert(otpChallenges).values({
        id: challengeId,
        phoneE164,
        codeHash: hashCode(challengeId, newCode),
        expiresAt: addSeconds(now, policy.otpTtlSeconds),
        createdAt: now,
      });
      return { id: challengeId, code: newCode };
    });

    try {
      await sms.send({
        to: phoneE164,
        body: `Your Service Marketplace verification code is ${code}. It expires in ${String(
          Math.round(policy.otpTtlSeconds / 60),
        )} minutes. Do not share it with anyone.`,
      });
    } catch (cause) {
      // Nothing was delivered, so drop the challenge: the user should be able to
      // retry immediately instead of waiting out a cooldown for a code they never got.
      await db.delete(otpChallenges).where(eq(otpChallenges.id, id));
      throw new AppError(
        503,
        ErrorCode.SmsUnavailable,
        'The verification code could not be sent. Please try again shortly.',
        { cause },
      );
    }

    return {
      challengeId: id,
      expiresInSeconds: policy.otpTtlSeconds,
      resendAfterSeconds: policy.otpResendCooldownSeconds,
    };
  }

  /**
   * Checks a submitted code. Does NOT consume the challenge; the caller does
   * that (via {@link consume}) in the same transaction that signs the user in.
   *
   * The attempt is counted with one atomic UPDATE *before* the code is
   * compared. Concurrent guesses therefore each burn an attempt, so parallel
   * requests cannot exceed the limit.
   */
  async function verifyCode(challengeId: string, code: string): Promise<VerifiedChallenge> {
    const now = clock();
    const live = and(
      eq(otpChallenges.id, challengeId),
      isNull(otpChallenges.consumedAt),
      isNull(otpChallenges.invalidatedAt),
      gt(otpChallenges.expiresAt, now),
    );

    const [challenge] = await db
      .update(otpChallenges)
      .set({ attempts: sql`${otpChallenges.attempts} + 1` })
      .where(and(live, lt(otpChallenges.attempts, policy.otpMaxAttempts)))
      .returning();

    if (!challenge) {
      // No attempt was available. Distinguish a locked live code (tell the user to
      // request a new one) from every other failure (all indistinguishable).
      const [locked] = await db.select({ id: otpChallenges.id }).from(otpChallenges).where(live);
      throw locked ? attemptsExceeded() : invalidOtp();
    }

    if (!safeEqual(challenge.codeHash, hashCode(challenge.id, code))) {
      throw challenge.attempts >= policy.otpMaxAttempts ? attemptsExceeded() : invalidOtp();
    }

    return { id: challenge.id, phoneE164: challenge.phoneE164 };
  }

  /**
   * Marks the challenge used. Returns false if it was already consumed,
   * replaced or expired in the meantime, which is what makes a code single-use
   * even under concurrent requests.
   */
  async function consume(tx: Transaction, challengeId: string): Promise<boolean> {
    const now = clock();
    const consumed = await tx
      .update(otpChallenges)
      .set({ consumedAt: now })
      .where(
        and(
          eq(otpChallenges.id, challengeId),
          isNull(otpChallenges.consumedAt),
          isNull(otpChallenges.invalidatedAt),
          gt(otpChallenges.expiresAt, now),
        ),
      )
      .returning({ id: otpChallenges.id });
    return consumed.length === 1;
  }

  return { requestOtp, verifyCode, consume };
}

export type OtpService = ReturnType<typeof createOtpService>;

// Exported so the sign-in flow can report a lost consume race the same way.
export { invalidOtp };
