import { and, eq, gt, isNull } from 'drizzle-orm';

import type { Database, Transaction } from '../../db/client.js';
import { authSessions, refreshTokens, users } from '../../db/schema/index.js';
import { addSeconds, type Clock } from '../../lib/clock.js';
import { randomToken, sha256Hex } from '../../lib/crypto.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import type { AuthPolicy } from './auth.policy.js';
import type { AccessTokenService } from './token.service.js';

/** What a client receives on sign-in and on every refresh. */
export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresInSeconds: number;
}

export type SessionCheck = { ok: true } | { ok: false; reason: 'invalid' | 'suspended' };

export interface SessionServiceDeps {
  db: Database;
  clock: Clock;
  policy: AuthPolicy;
  accessTokens: AccessTokenService;
  logger: Logger;
}

/** One message for every refresh failure: expired, unknown, revoked, reused. */
const invalidRefreshToken = () =>
  new AppError(
    401,
    ErrorCode.InvalidRefreshToken,
    'The session is no longer valid. Sign in again.',
  );

type RefreshOutcome = { kind: 'ok'; tokens: AuthTokens } | { kind: 'reuse' } | { kind: 'invalid' };

export function createSessionService({
  db,
  clock,
  policy,
  accessTokens,
  logger,
}: SessionServiceDeps) {
  /** Stores a new single-use refresh token for `sessionId` and returns the raw value. */
  async function issueRefreshToken(
    tx: Transaction,
    sessionId: string,
    sessionExpiresAt: Date,
    now: Date,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomToken();
    // A refresh token never outlives its session.
    const ttlExpiry = addSeconds(now, policy.refreshTokenTtlSeconds);
    const expiresAt = ttlExpiry < sessionExpiresAt ? ttlExpiry : sessionExpiresAt;
    await tx.insert(refreshTokens).values({
      sessionId,
      tokenHash: sha256Hex(token),
      expiresAt,
      createdAt: now,
    });
    return { token, expiresAt };
  }

  async function buildTokens(
    userId: string,
    sessionId: string,
    refresh: { token: string; expiresAt: Date },
    now: Date,
  ): Promise<AuthTokens> {
    const access = await accessTokens.sign({ userId, sessionId });
    return {
      accessToken: access.token,
      accessTokenExpiresInSeconds: access.expiresInSeconds,
      refreshToken: refresh.token,
      refreshTokenExpiresInSeconds: Math.floor(
        (refresh.expiresAt.getTime() - now.getTime()) / 1000,
      ),
    };
  }

  /** Starts a session for `userId` inside the caller's transaction (used at sign-in). */
  async function createSession(
    tx: Transaction,
    userId: string,
  ): Promise<AuthTokens & { sessionId: string }> {
    const now = clock();
    const sessionExpiresAt = addSeconds(now, policy.sessionMaxAgeSeconds);
    const [session] = await tx
      .insert(authSessions)
      .values({ userId, expiresAt: sessionExpiresAt, createdAt: now })
      .returning({ id: authSessions.id });
    if (!session) throw new Error('Session insert returned no row');

    const refresh = await issueRefreshToken(tx, session.id, sessionExpiresAt, now);
    return { sessionId: session.id, ...(await buildTokens(userId, session.id, refresh, now)) };
  }

  /**
   * Exchanges a refresh token for a new access + refresh token pair.
   *
   * Refresh tokens are single-use. Presenting one that was already exchanged
   * means either the client replayed it or it was stolen, and we cannot tell
   * which party is the real one, so the whole session is revoked. The outcome
   * is computed inside the transaction and the error thrown after it commits,
   * so the revocation is not rolled back.
   */
  async function refresh(rawToken: string): Promise<AuthTokens> {
    const now = clock();

    const outcome = await db.transaction(async (tx): Promise<RefreshOutcome> => {
      const [row] = await tx
        .select({
          token: refreshTokens,
          session: authSessions,
          userStatus: users.status,
          userDeletedAt: users.deletedAt,
        })
        .from(refreshTokens)
        .innerJoin(authSessions, eq(refreshTokens.sessionId, authSessions.id))
        .innerJoin(users, eq(authSessions.userId, users.id))
        .where(eq(refreshTokens.tokenHash, sha256Hex(rawToken)));

      if (!row) return { kind: 'invalid' };
      const { token, session } = row;

      if (session.revokedAt !== null || session.expiresAt <= now) return { kind: 'invalid' };
      if (row.userDeletedAt !== null || row.userStatus !== 'active') return { kind: 'invalid' };

      const revokeForReuse = async (): Promise<RefreshOutcome> => {
        await tx
          .update(authSessions)
          .set({ revokedAt: now, revokedReason: 'refresh_token_reuse' })
          .where(and(eq(authSessions.id, session.id), isNull(authSessions.revokedAt)));
        return { kind: 'reuse' };
      };

      if (token.usedAt !== null) return revokeForReuse();

      // Atomic claim: only one caller can flip usedAt from NULL, so two
      // concurrent refreshes with the same token cannot both succeed.
      const claimed = await tx
        .update(refreshTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(refreshTokens.id, token.id),
            isNull(refreshTokens.usedAt),
            gt(refreshTokens.expiresAt, now),
          ),
        )
        .returning({ id: refreshTokens.id });

      if (claimed.length === 0) {
        // Not claimable: either it expired, or a concurrent request just used it.
        return token.expiresAt <= now ? { kind: 'invalid' } : revokeForReuse();
      }

      const next = await issueRefreshToken(tx, session.id, session.expiresAt, now);
      return { kind: 'ok', tokens: await buildTokens(session.userId, session.id, next, now) };
    });

    if (outcome.kind === 'reuse') {
      logger.warn('Refresh token reuse detected; session revoked');
    }
    if (outcome.kind !== 'ok') throw invalidRefreshToken();
    return outcome.tokens;
  }

  /**
   * Ends the session a refresh token belongs to. Always succeeds from the
   * caller's point of view (unknown or already-revoked tokens included), so it
   * cannot be used to probe which tokens exist.
   */
  async function logout(rawToken: string): Promise<void> {
    const now = clock();
    const [row] = await db
      .select({ sessionId: refreshTokens.sessionId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256Hex(rawToken)));
    if (!row) return;

    await db
      .update(authSessions)
      .set({ revokedAt: now, revokedReason: 'logout' })
      .where(and(eq(authSessions.id, row.sessionId), isNull(authSessions.revokedAt)));
  }

  /** Is this (access-token) session still usable, and is its user allowed in? */
  async function checkSession(sessionId: string, userId: string): Promise<SessionCheck> {
    const now = clock();
    const [row] = await db
      .select({
        revokedAt: authSessions.revokedAt,
        expiresAt: authSessions.expiresAt,
        status: users.status,
        deletedAt: users.deletedAt,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)));

    if (!row) return { ok: false, reason: 'invalid' };
    if (row.revokedAt !== null || row.expiresAt <= now || row.deletedAt !== null) {
      return { ok: false, reason: 'invalid' };
    }
    if (row.status !== 'active') return { ok: false, reason: 'suspended' };
    return { ok: true };
  }

  return { createSession, refresh, logout, checkSession };
}

export type SessionService = ReturnType<typeof createSessionService>;
