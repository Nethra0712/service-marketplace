import { and, eq, isNull } from 'drizzle-orm';

import type { Database, Transaction } from '../../db/client.js';
import { profiles, providerProfiles, users, type User } from '../../db/schema/index.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import { invalidOtp, type OtpService } from './otp.service.js';
import type { AuthTokens, SessionService } from './session.service.js';

export type Role = 'customer' | 'provider';

/** What the API tells a signed-in user about themselves. */
export interface CurrentUser {
  id: string;
  phone: string;
  status: User['status'];
  /** Everyone is a customer; `provider` appears once a provider profile exists. */
  roles: Role[];
  profile: { fullName: string | null; preferredLanguage: 'en' | 'si' | 'ta' } | null;
  createdAt: string;
}

export interface AuthServiceDeps {
  db: Database;
  otp: OtpService;
  sessions: SessionService;
  logger: Logger;
}

type SignInOutcome =
  | { kind: 'ok'; tokens: AuthTokens; userId: string; sessionId: string }
  | { kind: 'lost-race' }
  | { kind: 'suspended' };

export function createAuthService({ db, otp, sessions, logger }: AuthServiceDeps) {
  /**
   * Finds the live account for a verified phone number or creates it. The very
   * first successful verification is what creates an account.
   */
  async function findOrCreateUser(tx: Transaction, phoneE164: string): Promise<User> {
    const findLive = () =>
      tx
        .select()
        .from(users)
        .where(and(eq(users.phoneE164, phoneE164), isNull(users.deletedAt)));

    const [existing] = await findLive();
    if (existing) return existing;

    // Another request may create the same account concurrently; the unique
    // index makes the loser's insert a no-op and we read the winner's row.
    const [created] = await tx
      .insert(users)
      .values({ phoneE164 })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const [raced] = await findLive();
    if (!raced) throw new Error('User could not be created or found');
    return raced;
  }

  /**
   * Verifies the code, then signs the user in (creating the account if it is
   * new). Consuming the code, creating the user and creating the session happen
   * in one transaction, so a code is never spent without a session to show for it.
   */
  async function verifyOtp(challengeId: string, code: string): Promise<AuthTokens> {
    const challenge = await otp.verifyCode(challengeId, code);

    const outcome = await db.transaction(async (tx): Promise<SignInOutcome> => {
      // Lost a race with another request that used this same code.
      if (!(await otp.consume(tx, challenge.id))) return { kind: 'lost-race' };

      const user = await findOrCreateUser(tx, challenge.phoneE164);
      // The code stays consumed even when the account may not sign in.
      if (user.status !== 'active') return { kind: 'suspended' };

      const { sessionId, ...tokens } = await sessions.createSession(tx, user.id);
      return { kind: 'ok', tokens, userId: user.id, sessionId };
    });

    if (outcome.kind === 'lost-race') throw invalidOtp();
    if (outcome.kind === 'suspended') {
      // Only reachable after proving ownership of the phone with a valid code,
      // so this does not reveal anything to a third party.
      throw new AppError(403, ErrorCode.AccountSuspended, 'This account is suspended.');
    }

    logger.info({ userId: outcome.userId, sessionId: outcome.sessionId }, 'User signed in');
    return outcome.tokens;
  }

  async function getCurrentUser(userId: string): Promise<CurrentUser> {
    const [row] = await db
      .select({ user: users, profile: profiles })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!row) throw new AppError(401, ErrorCode.Unauthenticated, 'Authentication required.');

    const [provider] = await db
      .select({ id: providerProfiles.id })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId));

    return {
      id: row.user.id,
      phone: row.user.phoneE164,
      status: row.user.status,
      roles: provider ? ['customer', 'provider'] : ['customer'],
      profile: row.profile
        ? { fullName: row.profile.fullName, preferredLanguage: row.profile.preferredLanguage }
        : null,
      createdAt: row.user.createdAt.toISOString(),
    };
  }

  return { verifyOtp, getCurrentUser };
}

export type AuthService = ReturnType<typeof createAuthService>;
