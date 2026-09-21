import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { otpChallenges, users } from '../../src/db/schema/index.js';
import type { SmsProvider } from '../../src/modules/sms/index.js';
import { buildTestApp } from '../helpers/app.js';
import { codeSentTo, requestOtp, signIn, type OtpChallengeResponse } from '../helpers/auth.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { errorOf } from '../helpers/http.js';
import { nextPhone } from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

describe('POST /api/auth/otp/request: validation', () => {
  it.each([
    ['a missing phone', {}],
    ['a non-string phone', { phone: 94771234567 }],
    ['a local-format number', { phone: '0771234567' }],
    ['a number without the plus', { phone: '94771234567' }],
    ['letters', { phone: '+9477abc4567' }],
    ['a too-short number', { phone: '+94123' }],
    ['a too-long number', { phone: '+9477123456789012345' }],
    ['a number from a country that is not allowed', { phone: '+14155550100' }],
    ['unexpected extra fields', { phone: '+94771234567', role: 'admin' }],
  ])('rejects %s with a 400 and sends nothing', async (_name, body) => {
    const { app, sms } = buildTestApp({ db });

    const res = await request(app).post('/api/auth/otp/request').send(body);

    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(sms.sent).toHaveLength(0);
    expect(await db.select().from(otpChallenges)).toHaveLength(0);
  });

  it('rejects a request with no JSON body', async () => {
    const { app } = buildTestApp({ db });
    const res = await request(app).post('/api/auth/otp/request');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/otp/request: success', () => {
  it('sends a numeric code by SMS and returns only the challenge details', async () => {
    const { app, sms } = buildTestApp({ db });
    const phone = nextPhone();

    const res = await requestOtp(app, phone);

    expect(res.status).toBe(202);
    expect(Object.keys(res.body as object).sort()).toEqual([
      'challengeId',
      'expiresInSeconds',
      'resendAfterSeconds',
    ]);
    const body = res.body as OtpChallengeResponse;
    expect(body.expiresInSeconds).toBe(300);
    expect(body.resendAfterSeconds).toBe(60);

    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0]?.to).toBe(phone);
    const code = codeSentTo(sms, phone);
    expect(code).toMatch(/^\d{6}$/);
    // The code only travels over SMS, never in the HTTP response.
    expect(res.text).not.toContain(code);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('stores only a keyed hash of the code, never the code', async () => {
    const { app, sms } = buildTestApp({ db });
    const phone = nextPhone();

    const res = await requestOtp(app, phone);
    const code = codeSentTo(sms, phone);
    const [row] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, (res.body as OtpChallengeResponse).challengeId));

    expect(row?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.codeHash).not.toContain(code);
    expect(row?.attempts).toBe(0);
    expect(row?.consumedAt).toBeNull();
    expect(row?.expiresAt.getTime()).toBeGreaterThan(row?.createdAt.getTime() ?? Infinity);
  });

  it('generates different codes for different requests', async () => {
    const { app, sms } = buildTestApp({ db });
    const codes = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const phone = nextPhone();
      await requestOtp(app, phone);
      codes.add(codeSentTo(sms, phone));
    }
    // 12 random 6-digit codes colliding into a couple of values would mean a broken generator.
    expect(codes.size).toBeGreaterThan(8);
  });

  it('answers identically for a registered and an unregistered phone', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const registered = (await signIn(app, sms)).phone;
    clock.advanceSeconds(61);

    const forRegistered = await requestOtp(app, registered);
    const forUnknown = await requestOtp(app, nextPhone());

    expect(forRegistered.status).toBe(forUnknown.status);
    expect(Object.keys(forRegistered.body as object).sort()).toEqual(
      Object.keys(forUnknown.body as object).sort(),
    );
    expect(forRegistered.body).toMatchObject({ expiresInSeconds: 300, resendAfterSeconds: 60 });
  });

  it('does not create an account when only a code is requested', async () => {
    const { app } = buildTestApp({ db });
    await requestOtp(app, nextPhone());
    expect(await db.select().from(users)).toHaveLength(0);
  });
});

describe('POST /api/auth/otp/request: resend cooldown and volume limits', () => {
  it('blocks a second request inside the cooldown and tells the client how long to wait', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const phone = nextPhone();
    await requestOtp(app, phone);

    clock.advanceSeconds(20);
    const res = await requestOtp(app, phone);

    expect(res.status).toBe(429);
    expect(errorOf(res).code).toBe('OTP_RESEND_COOLDOWN');
    expect(Number(res.headers['retry-after'])).toBe(40);
    expect(sms.sent).toHaveLength(1);
  });

  it('allows a new request once the cooldown has passed', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const phone = nextPhone();
    await requestOtp(app, phone);

    clock.advanceSeconds(61);
    const res = await requestOtp(app, phone);

    expect(res.status).toBe(202);
    expect(sms.sent).toHaveLength(2);
  });

  it('applies the cooldown per phone, not globally', async () => {
    const { app } = buildTestApp({ db });
    await requestOtp(app, nextPhone());
    const other = await requestOtp(app, nextPhone());
    expect(other.status).toBe(202);
  });

  it('caps the number of codes per phone per hour', async () => {
    const { app, clock } = buildTestApp({ db, authPolicy: { otpMaxRequestsPerPhonePerHour: 3 } });
    const phone = nextPhone();

    for (let i = 0; i < 3; i += 1) {
      const ok = await requestOtp(app, phone);
      expect(ok.status).toBe(202);
      clock.advanceSeconds(61);
    }

    const blocked = await requestOtp(app, phone);
    expect(blocked.status).toBe(429);
    expect(errorOf(blocked).code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    // Once the oldest request leaves the one-hour window, a slot frees up.
    clock.advanceSeconds(3600);
    expect((await requestOtp(app, phone)).status).toBe(202);
  });

  it('lets exactly one of several simultaneous requests through', async () => {
    const { app, sms } = buildTestApp({ db });
    const phone = nextPhone();

    const results = await Promise.all(Array.from({ length: 6 }, () => requestOtp(app, phone)));

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([202, 429, 429, 429, 429, 429]);
    expect(sms.sent).toHaveLength(1);
    expect(await db.select().from(otpChallenges)).toHaveLength(1);
  });

  it('replaces the previous live code when a new one is issued', async () => {
    const { app, clock } = buildTestApp({ db });
    const phone = nextPhone();
    const first = (await requestOtp(app, phone)).body as OtpChallengeResponse;
    clock.advanceSeconds(61);
    await requestOtp(app, phone);

    const [old] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, first.challengeId));
    expect(old?.invalidatedAt).not.toBeNull();
  });
});

describe('POST /api/auth/otp/request: SMS delivery failure', () => {
  const failingSms: SmsProvider = {
    send: () => Promise.reject(new Error('vendor unreachable, api key SECRET-KEY-123')),
  };

  it('returns a generic 503, leaks nothing, and leaves no challenge behind', async () => {
    const { app } = buildTestApp({ db, smsOverride: failingSms });

    const res = await requestOtp(app, nextPhone());

    expect(res.status).toBe(503);
    expect(errorOf(res).code).toBe('SMS_UNAVAILABLE');
    expect(res.text).not.toContain('SECRET-KEY-123');
    expect(await db.select().from(otpChallenges)).toHaveLength(0);
  });

  it('does not make the user wait out a cooldown for a code they never received', async () => {
    const failing = buildTestApp({ db, smsOverride: failingSms });
    const phone = nextPhone();
    expect((await requestOtp(failing.app, phone)).status).toBe(503);

    const working = buildTestApp({ db });
    expect((await requestOtp(working.app, phone)).status).toBe(202);
  });
});

describe('POST /api/auth/otp/request: per-IP rate limit', () => {
  it('rejects requests over the limit with 429 and Retry-After', async () => {
    const { app } = buildTestApp({
      db,
      authPolicy: {
        rateLimits: {
          otpRequest: { windowMs: 60_000, limit: 3 },
          otpVerify: { windowMs: 60_000, limit: 100 },
          refresh: { windowMs: 60_000, limit: 100 },
        },
      },
    });

    for (let i = 0; i < 3; i += 1) {
      expect((await requestOtp(app, nextPhone())).status).toBe(202);
    }
    const limited = await requestOtp(app, nextPhone());

    expect(limited.status).toBe(429);
    expect(errorOf(limited).code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
});
