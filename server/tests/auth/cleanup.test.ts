import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { authSessions, otpChallenges, refreshTokens } from '../../src/db/schema/index.js';
import { addSeconds } from '../../src/lib/clock.js';
import { purgeExpiredAuthData } from '../../src/modules/auth/index.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createUser, only } from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

const DAY = 24 * 60 * 60;
const NOW = new Date('2026-06-15T12:00:00Z');
const daysFromNow = (days: number) => addSeconds(NOW, days * DAY);

let hashCounter = 0;
const nextHash = () => {
  hashCounter += 1;
  return hashCounter.toString(16).padStart(64, '0');
};

async function challenge(expiresInDays: number) {
  return only(
    await db
      .insert(otpChallenges)
      .values({
        phoneE164: '+94771234567',
        codeHash: nextHash(),
        createdAt: daysFromNow(expiresInDays - 1),
        expiresAt: daysFromNow(expiresInDays),
      })
      .returning(),
  );
}

async function session(
  userId: string,
  { expiresInDays, revokedDaysAgo }: { expiresInDays: number; revokedDaysAgo?: number },
) {
  return only(
    await db
      .insert(authSessions)
      .values({
        userId,
        createdAt: daysFromNow(expiresInDays - 30),
        expiresAt: daysFromNow(expiresInDays),
        ...(revokedDaysAgo === undefined
          ? {}
          : { revokedAt: daysFromNow(-revokedDaysAgo), revokedReason: 'logout' as const }),
      })
      .returning(),
  );
}

async function token(sessionId: string, expiresInDays: number) {
  return only(
    await db
      .insert(refreshTokens)
      .values({
        sessionId,
        tokenHash: nextHash(),
        createdAt: daysFromNow(expiresInDays - 30),
        expiresAt: daysFromNow(expiresInDays),
      })
      .returning(),
  );
}

describe('purgeExpiredAuthData', () => {
  it('removes OTP challenges that expired before the retention window, and keeps the rest', async () => {
    const old = await challenge(-10);
    const recentlyExpired = await challenge(-2);
    const live = await challenge(1);

    const result = await purgeExpiredAuthData(db, NOW);

    expect(result.otpChallenges).toBe(1);
    const remaining = (await db.select().from(otpChallenges)).map((c) => c.id);
    expect(remaining).not.toContain(old.id);
    expect(remaining).toContain(recentlyExpired.id);
    expect(remaining).toContain(live.id);
  });

  it('removes long-expired sessions together with their tokens', async () => {
    const user = await createUser(db);
    const expired = await session(user.id, { expiresInDays: -10 });
    await token(expired.id, -10);

    const result = await purgeExpiredAuthData(db, NOW);

    expect(result).toMatchObject({ refreshTokens: 1, sessions: 1 });
    expect(await db.select().from(authSessions)).toHaveLength(0);
    expect(await db.select().from(refreshTokens)).toHaveLength(0);
  });

  it('removes sessions revoked before the window, even if their tokens had not expired', async () => {
    const user = await createUser(db);
    const revoked = await session(user.id, { expiresInDays: 20, revokedDaysAgo: 10 });
    await token(revoked.id, 20);

    const result = await purgeExpiredAuthData(db, NOW);

    expect(result).toMatchObject({ refreshTokens: 1, sessions: 1 });
  });

  it('keeps recently revoked sessions and all live ones, with their tokens', async () => {
    const user = await createUser(db);
    const recentlyRevoked = await session(user.id, { expiresInDays: 20, revokedDaysAgo: 1 });
    const live = await session(user.id, { expiresInDays: 60 });
    await token(recentlyRevoked.id, 20);
    await token(live.id, 20);

    const result = await purgeExpiredAuthData(db, NOW);

    expect(result).toEqual({ otpChallenges: 0, refreshTokens: 0, sessions: 0 });
    expect(await db.select().from(authSessions)).toHaveLength(2);
    expect(await db.select().from(refreshTokens)).toHaveLength(2);
  });

  it('removes a long-expired token but keeps its still-live session and newer token', async () => {
    const user = await createUser(db);
    const live = await session(user.id, { expiresInDays: 60 });
    const stale = await token(live.id, -10);
    const current = await token(live.id, 20);

    const result = await purgeExpiredAuthData(db, NOW);

    expect(result).toMatchObject({ refreshTokens: 1, sessions: 0 });
    const remaining = (await db.select().from(refreshTokens)).map((t) => t.id);
    expect(remaining).toEqual([current.id]);
    expect(remaining).not.toContain(stale.id);
  });

  it('honours a custom retention period and is safe to run repeatedly', async () => {
    await challenge(-2);

    const first = await purgeExpiredAuthData(db, NOW, { retentionDays: 1 });
    const second = await purgeExpiredAuthData(db, NOW, { retentionDays: 1 });

    expect(first.otpChallenges).toBe(1);
    expect(second).toEqual({ otpChallenges: 0, refreshTokens: 0, sessions: 0 });
  });
});
