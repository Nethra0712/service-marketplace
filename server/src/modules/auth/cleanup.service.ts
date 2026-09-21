import { and, inArray, isNotNull, lt, notExists, or, eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { authSessions, otpChallenges, refreshTokens } from '../../db/schema/index.js';
import { addSeconds } from '../../lib/clock.js';

export interface PurgeResult {
  otpChallenges: number;
  refreshTokens: number;
  sessions: number;
}

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Deletes authentication rows that can no longer matter: OTP challenges,
 * refresh tokens and sessions that expired or were revoked more than
 * `retentionDays` ago. The retention window keeps recent history available for
 * investigating abuse. Run it periodically (a scheduler arrives with the worker
 * infrastructure; until then `npm run auth:purge`).
 *
 * Live rows are never touched: only rows whose end date is older than the cutoff.
 */
export async function purgeExpiredAuthData(
  db: Database,
  now: Date,
  { retentionDays = 7 }: { retentionDays?: number } = {},
): Promise<PurgeResult> {
  const cutoff = addSeconds(now, -retentionDays * DAY_SECONDS);

  return db.transaction(async (tx) => {
    const deadOtp = await tx
      .delete(otpChallenges)
      .where(lt(otpChallenges.expiresAt, cutoff))
      .returning({ id: otpChallenges.id });

    const deadSessionIds = tx
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(
        or(
          lt(authSessions.expiresAt, cutoff),
          and(isNotNull(authSessions.revokedAt), lt(authSessions.revokedAt, cutoff)),
        ),
      );

    // Tokens go first: they reference their session.
    const deadTokens = await tx
      .delete(refreshTokens)
      .where(
        or(lt(refreshTokens.expiresAt, cutoff), inArray(refreshTokens.sessionId, deadSessionIds)),
      )
      .returning({ id: refreshTokens.id });

    const deadSessions = await tx
      .delete(authSessions)
      .where(
        and(
          inArray(authSessions.id, deadSessionIds),
          notExists(
            tx
              .select({ id: refreshTokens.id })
              .from(refreshTokens)
              .where(eq(refreshTokens.sessionId, authSessions.id)),
          ),
        ),
      )
      .returning({ id: authSessions.id });

    return {
      otpChallenges: deadOtp.length,
      refreshTokens: deadTokens.length,
      sessions: deadSessions.length,
    };
  });
}
