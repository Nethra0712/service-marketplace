import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { decodeJwt, SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { authSessions, refreshTokens, users } from '../../src/db/schema/index.js';
import { sha256Hex } from '../../src/lib/crypto.js';
import { buildTestApp, TEST_JWT_SECRET } from '../helpers/app.js';
import { logout, me, refreshTokens as refresh, signIn, type Tokens } from '../helpers/auth.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { only } from '../helpers/factories.js';
import { errorOf } from '../helpers/http.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

const sessionRow = async () => only(await db.select().from(authSessions));

describe('protected routes and access-token validation', () => {
  it('serves /me to a valid access token, with the current user and nothing sensitive', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens, phone } = await signIn(app, sms);

    const res = await me(app, tokens.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      phone,
      status: 'active',
      roles: ['customer'],
      profile: null,
    });
    expect(Object.keys(res.body as object).sort()).toEqual([
      'createdAt',
      'id',
      'phone',
      'profile',
      'roles',
      'status',
    ]);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('puts only the user id, session id and timing in the access token', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);
    const user = only(await db.select().from(users));
    const session = await sessionRow();

    const claims = decodeJwt(tokens.accessToken);

    expect(claims.sub).toBe(user.id);
    expect(claims.sid).toBe(session.id);
    expect(claims.iss).toBe('service-marketplace-api');
    expect(claims.aud).toBe('service-marketplace-app');
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(900);
    expect(Math.abs((claims.iat ?? 0) - Math.floor(clock.now().getTime() / 1000))).toBeLessThan(3);
    // No phone number or other personal data inside a token that is sent on every request.
    expect(Object.keys(claims).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'jti', 'sid', 'sub']);
  });

  const validClaims = (userId: string, sessionId: string) => ({ sub: userId, sid: sessionId });

  async function craft(options: {
    userId: string;
    sessionId: string;
    secret?: string;
    audience?: string;
    issuer?: string;
    expiresInSeconds?: number;
    omitSession?: boolean;
  }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const claims = validClaims(options.userId, options.sessionId);
    return new SignJWT(options.omitSession ? {} : { sid: claims.sid })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.sub)
      .setIssuer(options.issuer ?? 'service-marketplace-api')
      .setAudience(options.audience ?? 'service-marketplace-app')
      .setIssuedAt(now)
      .setExpirationTime(now + (options.expiresInSeconds ?? 900))
      .sign(new TextEncoder().encode(options.secret ?? TEST_JWT_SECRET));
  }

  it('rejects every kind of bad credential with the same generic 401', async () => {
    const { app, sms } = buildTestApp({ db });
    await signIn(app, sms);
    const user = only(await db.select().from(users));
    const session = await sessionRow();
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

    const attempts: [string, string | undefined][] = [
      ['no Authorization header', undefined],
      ['an empty bearer token', 'Bearer '],
      ['a non-bearer scheme', 'Basic dXNlcjpwYXNz'],
      ['a garbage token', 'Bearer not.a.jwt'],
      ['a random string', 'Bearer abcdef'],
      [
        'a token signed with a different secret',
        `Bearer ${await craft({ userId: user.id, sessionId: session.id, secret: 'x'.repeat(40) })}`,
      ],
      [
        'a token for the wrong audience',
        `Bearer ${await craft({ userId: user.id, sessionId: session.id, audience: 'someone-else' })}`,
      ],
      [
        'a token from the wrong issuer',
        `Bearer ${await craft({ userId: user.id, sessionId: session.id, issuer: 'evil' })}`,
      ],
      [
        'a token that is already expired',
        `Bearer ${await craft({ userId: user.id, sessionId: session.id, expiresInSeconds: -60 })}`,
      ],
      [
        'a token with no session claim',
        `Bearer ${await craft({ userId: user.id, sessionId: session.id, omitSession: true })}`,
      ],
      [
        'a token for a session that does not exist',
        `Bearer ${await craft({ userId: user.id, sessionId: randomUUID() })}`,
      ],
      [
        'an unsigned token (alg none)',
        `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64({
          sub: user.id,
          sid: session.id,
          iss: 'service-marketplace-api',
          aud: 'service-marketplace-app',
          exp: Math.floor(Date.now() / 1000) + 900,
        })}.`,
      ],
    ];

    for (const [name, header] of attempts) {
      const req = request(app).get('/api/auth/me');
      const res = await (header === undefined ? req : req.set('Authorization', header));

      expect(res.status, name).toBe(401);
      expect(errorOf(res).code, name).toBe('UNAUTHENTICATED');
      expect(errorOf(res).message, name).toBe('Authentication required.');
      expect(res.headers['www-authenticate'], name).toBe('Bearer');
    }
  });

  it('rejects an access token once it has expired', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);

    clock.advanceSeconds(890);
    expect((await me(app, tokens.accessToken)).status).toBe(200);

    clock.advanceSeconds(30);
    const res = await me(app, tokens.accessToken);
    expect(res.status).toBe(401);
    expect(errorOf(res).code).toBe('UNAUTHENTICATED');
  });

  it('rejects a token whose session was revoked', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);
    await db
      .update(authSessions)
      .set({ revokedAt: new Date(), revokedReason: 'logout' })
      .where(eq(authSessions.id, (await sessionRow()).id));

    const res = await me(app, tokens.accessToken);

    expect(res.status).toBe(401);
  });

  it('rejects a token whose session has passed its absolute lifetime', async () => {
    const { app, sms, clock } = buildTestApp({
      db,
      authPolicy: { sessionMaxAgeSeconds: 600, accessTokenTtlSeconds: 3000 },
    });
    const { tokens } = await signIn(app, sms);

    clock.advanceSeconds(601);

    expect((await me(app, tokens.accessToken)).status).toBe(401);
  });

  it('refuses a suspended user immediately, and lets them back once reinstated', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);
    const user = only(await db.select().from(users));

    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, user.id));
    const blocked = await me(app, tokens.accessToken);
    expect(blocked.status).toBe(403);
    expect(errorOf(blocked).code).toBe('ACCOUNT_SUSPENDED');

    await db.update(users).set({ status: 'active' }).where(eq(users.id, user.id));
    expect((await me(app, tokens.accessToken)).status).toBe(200);
  });

  it('refuses a token whose user was deleted', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);
    await db.update(users).set({ deletedAt: new Date() });

    expect((await me(app, tokens.accessToken)).status).toBe(401);
  });
});

describe('POST /api/auth/refresh: rotation', () => {
  it('issues a new pair and the new access token works', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);

    const res = await refresh(app, tokens.refreshToken);

    expect(res.status).toBe(200);
    const next = res.body as Tokens;
    expect(next.tokenType).toBe('Bearer');
    expect(next.accessToken).not.toBe(tokens.accessToken);
    expect(next.refreshToken).not.toBe(tokens.refreshToken);
    expect((await me(app, next.accessToken)).status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('marks the old token used and keeps exactly one unused token per session', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);

    await refresh(app, tokens.refreshToken);
    const rows = await db.select().from(refreshTokens);

    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.usedAt === null)).toHaveLength(1);
    const old = rows.find((r) => r.tokenHash === sha256Hex(tokens.refreshToken));
    expect(old?.usedAt).not.toBeNull();
  });

  it('stores refresh tokens only as hashes', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);
    const next = (await refresh(app, tokens.refreshToken)).body as Tokens;

    const rows = await db.select().from(refreshTokens);

    for (const raw of [tokens.refreshToken, next.refreshToken]) {
      expect(rows.map((r) => r.tokenHash)).toContain(sha256Hex(raw));
      expect(rows.map((r) => r.tokenHash)).not.toContain(raw);
    }
  });

  it('allows a chain of refreshes, each token usable once', async () => {
    const { app, sms } = buildTestApp({ db });
    let current = (await signIn(app, sms)).tokens;

    for (let i = 0; i < 4; i += 1) {
      const res = await refresh(app, current.refreshToken);
      expect(res.status).toBe(200);
      current = res.body as Tokens;
    }

    expect((await me(app, current.accessToken)).status).toBe(200);
    expect((await sessionRow()).revokedAt).toBeNull();
  });

  it('never lets a refresh token outlive the session', async () => {
    const { app, sms, clock } = buildTestApp({
      db,
      authPolicy: { sessionMaxAgeSeconds: 100, refreshTokenTtlSeconds: 5000 },
    });
    const { tokens } = await signIn(app, sms);
    expect(tokens.refreshTokenExpiresInSeconds).toBeLessThanOrEqual(100);

    clock.advanceSeconds(101);
    const res = await refresh(app, tokens.refreshToken);

    expect(res.status).toBe(401);
    expect(errorOf(res).code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects an expired refresh token without treating it as theft', async () => {
    const { app, sms, clock } = buildTestApp({ db, authPolicy: { refreshTokenTtlSeconds: 60 } });
    const { tokens } = await signIn(app, sms);

    clock.advanceSeconds(61);
    const res = await refresh(app, tokens.refreshToken);

    expect(res.status).toBe(401);
    expect(errorOf(res).code).toBe('INVALID_REFRESH_TOKEN');
    expect((await sessionRow()).revokedAt).toBeNull();
  });

  it('rejects unknown and malformed refresh tokens with the same generic error', async () => {
    const { app } = buildTestApp({ db });

    const unknown = await refresh(app, 'x'.repeat(43));
    expect(unknown.status).toBe(401);
    expect(errorOf(unknown).code).toBe('INVALID_REFRESH_TOKEN');

    for (const body of [{}, { refreshToken: 'short' }, { refreshToken: 123 }, { token: 'x' }]) {
      const res = await request(app).post('/api/auth/refresh').send(body);
      expect(res.status).toBe(400);
    }
  });

  it('refuses to refresh for a suspended user', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);
    await db.update(users).set({ status: 'suspended' });

    const res = await refresh(app, tokens.refreshToken);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh: reuse detection', () => {
  it('revokes the whole session when an already-used token is presented again', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens: first } = await signIn(app, sms);
    const second = (await refresh(app, first.refreshToken)).body as Tokens;

    // The first token was already exchanged. Presenting it again means theft or replay.
    const replay = await refresh(app, first.refreshToken);

    expect(replay.status).toBe(401);
    expect(errorOf(replay).code).toBe('INVALID_REFRESH_TOKEN');
    const session = await sessionRow();
    expect(session.revokedAt).not.toBeNull();
    expect(session.revokedReason).toBe('refresh_token_reuse');

    // Everyone holding credentials for that session is locked out, including the current holder.
    expect((await refresh(app, second.refreshToken)).status).toBe(401);
    expect((await me(app, second.accessToken)).status).toBe(401);
    expect((await me(app, first.accessToken)).status).toBe(401);
  });

  it('leaves the same user’s other sessions untouched', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const deviceA = await signIn(app, sms);
    clock.advanceSeconds(61);
    const deviceB = await signIn(app, sms, deviceA.phone);

    // Device A's token is exchanged once, then replayed.
    await refresh(app, deviceA.tokens.refreshToken);
    await refresh(app, deviceA.tokens.refreshToken);

    const sessions = await db.select().from(authSessions);
    expect(sessions.filter((s) => s.revokedAt !== null)).toHaveLength(1);
    expect((await me(app, deviceB.tokens.accessToken)).status).toBe(200);
    expect((await refresh(app, deviceB.tokens.refreshToken)).status).toBe(200);
  });

  it('lets only one of two simultaneous refreshes with the same token succeed', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);

    const results = await Promise.all([
      refresh(app, tokens.refreshToken),
      refresh(app, tokens.refreshToken),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    // The loser is indistinguishable from a replay, so the session is revoked.
    expect((await sessionRow()).revokedReason).toBe('refresh_token_reuse');
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session: the access token and refresh token both stop working', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);

    const res = await logout(app, tokens.refreshToken);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect((await me(app, tokens.accessToken)).status).toBe(401);
    const afterLogout = await refresh(app, tokens.refreshToken);
    expect(afterLogout.status).toBe(401);
    expect(errorOf(afterLogout).code).toBe('INVALID_REFRESH_TOKEN');
    const session = await sessionRow();
    expect(session.revokedAt).not.toBeNull();
    expect(session.revokedReason).toBe('logout');
  });

  it('works without any access token, so an expired one cannot block signing out', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);
    clock.advanceSeconds(3600);

    const res = await logout(app, tokens.refreshToken);

    expect(res.status).toBe(204);
    expect((await sessionRow()).revokedReason).toBe('logout');
  });

  it('also ends the session when the token presented is an older, already-used one', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);
    const next = (await refresh(app, tokens.refreshToken)).body as Tokens;

    await logout(app, tokens.refreshToken);

    expect((await me(app, next.accessToken)).status).toBe(401);
  });

  it('is idempotent and reveals nothing about whether a token exists', async () => {
    const { app, sms } = buildTestApp({ db });
    const { tokens } = await signIn(app, sms);

    expect((await logout(app, tokens.refreshToken)).status).toBe(204);
    expect((await logout(app, tokens.refreshToken)).status).toBe(204);
    expect((await logout(app, 'x'.repeat(43))).status).toBe(204);
  });

  it('signs out one device without affecting another of the same user', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const deviceA = await signIn(app, sms);
    clock.advanceSeconds(61);
    const deviceB = await signIn(app, sms, deviceA.phone);

    await logout(app, deviceB.tokens.refreshToken);

    expect((await me(app, deviceB.tokens.accessToken)).status).toBe(401);
    expect((await me(app, deviceA.tokens.accessToken)).status).toBe(200);
    expect((await refresh(app, deviceA.tokens.refreshToken)).status).toBe(200);
  });

  it('validates its input', async () => {
    const { app } = buildTestApp({ db });
    expect((await request(app).post('/api/auth/logout').send({})).status).toBe(400);
  });
});

describe('per-IP rate limit on refresh and logout', () => {
  it('rejects refreshes over the limit with 429 and Retry-After', async () => {
    const { app } = buildTestApp({
      db,
      authPolicy: {
        rateLimits: {
          otpRequest: { windowMs: 60_000, limit: 100 },
          otpVerify: { windowMs: 60_000, limit: 100 },
          refresh: { windowMs: 60_000, limit: 3 },
        },
      },
    });

    for (let i = 0; i < 3; i += 1) {
      expect((await refresh(app, 'x'.repeat(43))).status).toBe(401);
    }
    const limited = await refresh(app, 'x'.repeat(43));

    expect(limited.status).toBe(429);
    expect(errorOf(limited).code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
});
