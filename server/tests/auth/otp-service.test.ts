import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { otpChallenges } from '../../src/db/schema/index.js';
import { defaultAuthPolicy } from '../../src/modules/auth/index.js';
import { createOtpService } from '../../src/modules/auth/otp.service.js';
import { MockSmsProvider } from '../../src/modules/sms/index.js';
import { FakeClock, TEST_OTP_SECRET } from '../helpers/app.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { nextPhone } from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

/**
 * These tests drive the OTP service directly to reproduce the narrow window
 * between "the code was verified" and "the code was consumed", which is where a
 * race between two simultaneous sign-ins would happen. Through HTTP that window
 * is a few microseconds wide, so it cannot be hit reliably.
 */
function setup() {
  const sms = new MockSmsProvider();
  const clock = new FakeClock();
  const otp = createOtpService({
    db,
    sms,
    clock: clock.now,
    policy: defaultAuthPolicy,
    hmacSecret: TEST_OTP_SECRET,
  });
  const consumeOnce = (challengeId: string) => db.transaction((tx) => otp.consume(tx, challengeId));
  return { otp, sms, clock, consumeOnce };
}

async function issue(ctx: ReturnType<typeof setup>) {
  const phone = nextPhone();
  const { challengeId } = await ctx.otp.requestOtp(phone);
  const code = ctx.sms.lastCodeTo(phone);
  if (!code) throw new Error('no code sent');
  return { phone, challengeId, code };
}

describe('OTP service: consuming a verified code', () => {
  it('lets exactly one of two callers that both verified the same code consume it', async () => {
    const ctx = setup();
    const { challengeId, code } = await issue(ctx);

    // Two sign-in requests both pass verification before either has consumed the code...
    const first = await ctx.otp.verifyCode(challengeId, code);
    const second = await ctx.otp.verifyCode(challengeId, code);
    expect(first.id).toBe(second.id);

    // ...but only one of them may be allowed to use it up.
    expect(await ctx.consumeOnce(challengeId)).toBe(true);
    expect(await ctx.consumeOnce(challengeId)).toBe(false);
  });

  it('refuses to consume a code that expired after it was verified', async () => {
    const ctx = setup();
    const { challengeId, code } = await issue(ctx);
    await ctx.otp.verifyCode(challengeId, code);

    ctx.clock.advanceSeconds(301);

    expect(await ctx.consumeOnce(challengeId)).toBe(false);
  });

  it('refuses to consume a code that was replaced by a newer one after it was verified', async () => {
    const ctx = setup();
    const { phone, challengeId, code } = await issue(ctx);
    await ctx.otp.verifyCode(challengeId, code);

    ctx.clock.advanceSeconds(61);
    await ctx.otp.requestOtp(phone);

    expect(await ctx.consumeOnce(challengeId)).toBe(false);
  });

  it('records when the code was consumed, exactly once', async () => {
    const ctx = setup();
    const { challengeId, code } = await issue(ctx);
    await ctx.otp.verifyCode(challengeId, code);

    await ctx.consumeOnce(challengeId);
    const [afterFirst] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, challengeId));
    ctx.clock.advanceSeconds(10);
    await ctx.consumeOnce(challengeId);
    const [afterSecond] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, challengeId));

    expect(afterFirst?.consumedAt).not.toBeNull();
    // The failed second attempt must not move the timestamp.
    expect(afterSecond?.consumedAt?.getTime()).toBe(afterFirst?.consumedAt?.getTime());
  });
});
