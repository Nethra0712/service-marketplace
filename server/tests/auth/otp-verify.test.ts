import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  authSessions,
  otpChallenges,
  profiles,
  refreshTokens,
  users,
} from '../../src/db/schema/index.js';
import { buildTestApp } from '../helpers/app.js';
import { requestOtp, signIn, startChallenge, verifyOtp, type Tokens } from '../helpers/auth.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createUser, nextPhone, only } from '../helpers/factories.js';
import { errorOf } from '../helpers/http.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

/** Any six-digit code that is not `code`. */
const wrongCodeFor = (code: string) => (code === '000000' ? '000001' : '000000');

describe('POST /api/auth/otp/verify: successful sign-in', () => {
  it('creates a new account on first successful verification and returns session credentials', async () => {
    const { app, sms } = buildTestApp({ db });
    const phone = nextPhone();
    const { challengeId, code } = await startChallenge(app, sms, phone);
    expect(await db.select().from(users)).toHaveLength(0);

    const res = await verifyOtp(app, challengeId, code);

    expect(res.status).toBe(200);
    const tokens = res.body as Tokens;
    expect(tokens.tokenType).toBe('Bearer');
    expect(tokens.accessToken.split('.')).toHaveLength(3);
    expect(tokens.refreshToken.length).toBeGreaterThanOrEqual(40);
    expect(tokens.accessTokenExpiresInSeconds).toBe(900);
    expect(tokens.refreshTokenExpiresInSeconds).toBe(30 * 24 * 60 * 60);
    expect(res.headers['cache-control']).toBe('no-store');

    const created = only(await db.select().from(users));
    expect(created.phoneE164).toBe(phone);
    expect(created.status).toBe('active');
    // Signing in creates the account only; a profile is added later by the user.
    expect(await db.select().from(profiles)).toHaveLength(0);
    expect(await db.select().from(authSessions)).toHaveLength(1);
    expect(await db.select().from(refreshTokens)).toHaveLength(1);
  });

  it('returns only credentials, with no account details, passwords or internal ids', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);

    expect(Object.keys(tokens).sort()).toEqual([
      'accessToken',
      'accessTokenExpiresInSeconds',
      'refreshToken',
      'refreshTokenExpiresInSeconds',
      'tokenType',
    ]);
  });

  it('logs an existing user back in without creating a second account', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const phone = nextPhone();
    await signIn(app, sms, phone);
    const firstUser = only(await db.select().from(users));
    clock.advanceSeconds(61);

    await signIn(app, sms, phone);

    const all = await db.select().from(users);
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(firstUser.id);
    // Each sign-in is its own session (one per device).
    expect(await db.select().from(authSessions)).toHaveLength(2);
  });

  it('marks the challenge as consumed', async () => {
    const { app, sms } = buildTestApp({ db });
    const { challengeId } = await signIn(app, sms);

    const [row] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId));
    expect(row?.consumedAt).not.toBeNull();
  });

  it('treats a soft-deleted account as gone and starts a fresh one for the same phone', async () => {
    const { app, sms } = buildTestApp({ db });
    const phone = nextPhone();
    const old = await createUser(db, phone);
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, old.id));

    await signIn(app, sms, phone);

    const all = await db.select().from(users);
    expect(all).toHaveLength(2);
    expect(all.find((u) => u.deletedAt === null)?.id).not.toBe(old.id);
  });
});

describe('POST /api/auth/otp/verify: wrong, expired and unknown codes', () => {
  it('rejects a wrong code with a generic 401 and does not sign in', async () => {
    const { app, sms } = buildTestApp({ db });
    const { challengeId, code } = await startChallenge(app, sms, nextPhone());

    const res = await verifyOtp(app, challengeId, wrongCodeFor(code));

    expect(res.status).toBe(401);
    expect(errorOf(res)).toMatchObject({
      code: 'INVALID_OTP',
      message: 'The code is invalid or has expired.',
    });
    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(authSessions)).toHaveLength(0);
  });

  it('counts every wrong attempt against the challenge', async () => {
    const { app, sms } = buildTestApp({ db });
    const { challengeId, code } = await startChallenge(app, sms, nextPhone());

    await verifyOtp(app, challengeId, wrongCodeFor(code));
    await verifyOtp(app, challengeId, wrongCodeFor(code));

    const [row] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId));
    expect(row?.attempts).toBe(2);
  });

  it('rejects an expired code, and creates no account', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const { challengeId, code } = await startChallenge(app, sms, nextPhone());

    clock.advanceSeconds(301);
    const res = await verifyOtp(app, challengeId, code);

    expect(res.status).toBe(401);
    expect(errorOf(res).code).toBe('INVALID_OTP');
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('accepts the code right up to its expiry', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const { challengeId, code } = await startChallenge(app, sms, nextPhone());

    clock.advanceSeconds(299);

    expect((await verifyOtp(app, challengeId, code)).status).toBe(200);
  });

  it('answers wrong, expired and unknown challenges with exactly the same error', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const wrong = await startChallenge(app, sms, nextPhone());
    const expired = await startChallenge(app, sms, nextPhone());
    clock.advanceSeconds(301);

    const responses = [
      await verifyOtp(app, wrong.challengeId, wrongCodeFor(wrong.code)),
      await verifyOtp(app, expired.challengeId, expired.code),
      await verifyOtp(app, '00000000-0000-4000-8000-000000000000', '123456'),
    ];

    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(errorOf(res).code).toBe('INVALID_OTP');
      expect(errorOf(res).message).toBe('The code is invalid or has expired.');
    }
  });
});

describe('POST /api/auth/otp/verify: brute-force protection', () => {
  it('locks the code after the maximum number of wrong attempts', async () => {
    const { app, sms } = buildTestApp({ db, authPolicy: { otpMaxAttempts: 3 } });
    const { challengeId, code } = await startChallenge(app, sms, nextPhone());
    const wrong = wrongCodeFor(code);

    expect((await verifyOtp(app, challengeId, wrong)).status).toBe(401);
    expect((await verifyOtp(app, challengeId, wrong)).status).toBe(401);
    const last = await verifyOtp(app, challengeId, wrong);

    // The final failed attempt tells the client to request a new code.
    expect(last.status).toBe(429);
    expect(errorOf(last).code).toBe('OTP_ATTEMPTS_EXCEEDED');
  });

  it('rejects even the CORRECT code once the attempt limit is reached', async () => {
    const { app, sms } = buildTestApp({ db, authPolicy: { otpMaxAttempts: 3 } });
    const { challengeId, code } = await startChallenge(app, sms, nextPhone());
    for (let i = 0; i < 3; i += 1) await verifyOtp(app, challengeId, wrongCodeFor(code));

    const res = await verifyOtp(app, challengeId, code);

    expect(res.status).toBe(429);
    expect(errorOf(res).code).toBe('OTP_ATTEMPTS_EXCEEDED');
    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(authSessions)).toHaveLength(0);
  });

  it('never allows more guesses than the limit, even when sent in parallel', async () => {
    const { app, sms } = buildTestApp({ db, authPolicy: { otpMaxAttempts: 3 } });
    const { challengeId, code } = await startChallenge(app, sms, nextPhone());

    await Promise.all(
      Array.from({ length: 12 }, () => verifyOtp(app, challengeId, wrongCodeFor(code))),
    );

    const [row] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId));
    expect(row?.attempts).toBe(3);
  });

  it('gives a fresh set of attempts only through a new code request', async () => {
    const { app, sms, clock } = buildTestApp({ db, authPolicy: { otpMaxAttempts: 2 } });
    const phone = nextPhone();
    const first = await startChallenge(app, sms, phone);
    for (let i = 0; i < 2; i += 1)
      await verifyOtp(app, first.challengeId, wrongCodeFor(first.code));

    clock.advanceSeconds(61);
    const second = await startChallenge(app, sms, phone);

    expect((await verifyOtp(app, second.challengeId, second.code)).status).toBe(200);
  });
});

describe('POST /api/auth/otp/verify: one-time use', () => {
  it('rejects a code that was already used', async () => {
    const { app, sms } = buildTestApp({ db });
    const { challengeId, code } = await signIn(app, sms);

    const replay = await verifyOtp(app, challengeId, code);

    expect(replay.status).toBe(401);
    expect(errorOf(replay).code).toBe('INVALID_OTP');
    expect(await db.select().from(authSessions)).toHaveLength(1);
  });

  it('lets only one of two simultaneous submissions of the same code succeed', async () => {
    const { app, sms } = buildTestApp({ db });
    const { challengeId, code } = await startChallenge(app, sms, nextPhone());

    const results = await Promise.all([
      verifyOtp(app, challengeId, code),
      verifyOtp(app, challengeId, code),
      verifyOtp(app, challengeId, code),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 401, 401]);
    expect(await db.select().from(users)).toHaveLength(1);
    expect(await db.select().from(authSessions)).toHaveLength(1);
  });

  it('invalidates the older code when a newer one is requested', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const phone = nextPhone();
    const older = await startChallenge(app, sms, phone);
    clock.advanceSeconds(61);
    const newer = await startChallenge(app, sms, phone);

    const useOlder = await verifyOtp(app, older.challengeId, older.code);
    const useNewer = await verifyOtp(app, newer.challengeId, newer.code);

    expect(useOlder.status).toBe(401);
    expect(useNewer.status).toBe(200);
  });

  it('does not let a code from one phone sign in as another', async () => {
    const { app, sms } = buildTestApp({ db });
    const alice = await startChallenge(app, sms, nextPhone());
    const bobPhone = nextPhone();
    await startChallenge(app, sms, bobPhone);

    const res = await verifyOtp(app, alice.challengeId, alice.code);

    // The account is created for the phone the code was sent to, and only that phone.
    expect(res.status).toBe(200);
    const all = await db.select().from(users);
    expect(all).toHaveLength(1);
    expect(all[0]?.phoneE164).not.toBe(bobPhone);
  });
});

describe('POST /api/auth/otp/verify: account state', () => {
  it('refuses a suspended account, but still uses up the code', async () => {
    const { app, sms } = buildTestApp({ db });
    const phone = nextPhone();
    const user = await createUser(db, phone);
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, user.id));
    const { challengeId, code } = await startChallenge(app, sms, phone);

    const res = await verifyOtp(app, challengeId, code);

    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('ACCOUNT_SUSPENDED');
    expect(await db.select().from(authSessions)).toHaveLength(0);
    const [row] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId));
    expect(row?.consumedAt).not.toBeNull();
  });
});

describe('POST /api/auth/otp/verify: validation', () => {
  it.each([
    ['a missing challengeId', { code: '123456' }],
    ['a challengeId that is not a UUID', { challengeId: 'abc', code: '123456' }],
    ['a missing code', { challengeId: '00000000-0000-4000-8000-000000000000' }],
    ['a non-numeric code', { challengeId: '00000000-0000-4000-8000-000000000000', code: 'abcdef' }],
    ['a too-short code', { challengeId: '00000000-0000-4000-8000-000000000000', code: '12' }],
    ['a numeric code', { challengeId: '00000000-0000-4000-8000-000000000000', code: 123456 }],
    [
      'extra fields',
      { challengeId: '00000000-0000-4000-8000-000000000000', code: '123456', admin: true },
    ],
  ])('rejects %s with a 400', async (_name, body) => {
    const { app } = buildTestApp({ db });
    const res = await request(app).post('/api/auth/otp/verify').send(body);
    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/otp/verify: per-IP rate limit', () => {
  it('rejects verification attempts over the limit with 429', async () => {
    const { app, sms } = buildTestApp({
      db,
      authPolicy: {
        rateLimits: {
          otpRequest: { windowMs: 60_000, limit: 100 },
          otpVerify: { windowMs: 60_000, limit: 3 },
          refresh: { windowMs: 60_000, limit: 100 },
        },
      },
    });
    const { challengeId, code } = await startChallenge(app, sms, nextPhone());

    for (let i = 0; i < 3; i += 1) await verifyOtp(app, challengeId, wrongCodeFor(code));
    const limited = await verifyOtp(app, challengeId, code);

    expect(limited.status).toBe(429);
    expect(errorOf(limited).code).toBe('RATE_LIMITED');
    // Blocked before the code was even checked.
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('is independent from the OTP request limit', async () => {
    const { app } = buildTestApp({
      db,
      authPolicy: {
        rateLimits: {
          otpRequest: { windowMs: 60_000, limit: 1 },
          otpVerify: { windowMs: 60_000, limit: 100 },
          refresh: { windowMs: 60_000, limit: 100 },
        },
      },
    });
    await requestOtp(app, nextPhone());
    expect((await requestOtp(app, nextPhone())).status).toBe(429);
    expect((await verifyOtp(app, '00000000-0000-4000-8000-000000000000', '123456')).status).toBe(
      401,
    );
  });
});
