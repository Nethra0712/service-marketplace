import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createLogger } from '../../src/lib/logger.js';
import { MockSmsProvider } from '../../src/modules/sms/index.js';
import { buildTestApp } from '../helpers/app.js';
import {
  codeSentTo,
  logout,
  me,
  refreshTokens,
  requestOtp,
  startChallenge,
  verifyOtp,
  type Tokens,
} from '../helpers/auth.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { nextPhone } from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

/** A logger that keeps every line in memory, at the most verbose level. */
function capturingLogger() {
  const lines: string[] = [];
  const logger = createLogger(
    { logLevel: 'trace' },
    {
      write: (line: string) => {
        lines.push(line);
      },
    },
  );
  return { logger, output: () => lines.join('\n') };
}

describe('log hygiene', () => {
  it('never writes OTPs, tokens or phone numbers to the log, across the whole auth lifecycle', async () => {
    const { logger, output } = capturingLogger();
    const { app, sms, clock } = buildTestApp({ db, logger });
    const phone = nextPhone();

    const first = await startChallenge(app, sms, phone);
    await verifyOtp(app, first.challengeId, first.code === '000000' ? '000001' : '000000');
    const signedIn = (await verifyOtp(app, first.challengeId, first.code)).body as Tokens;
    await me(app, signedIn.accessToken);
    const refreshed = (await refreshTokens(app, signedIn.refreshToken)).body as Tokens;
    await refreshTokens(app, signedIn.refreshToken); // replay: triggers reuse detection
    await me(app, 'Bearer-garbage');
    clock.advanceSeconds(61);
    await requestOtp(app, phone);
    await logout(app, refreshed.refreshToken);
    // A request that fails validation and one that hits the 404 handler.
    await request(app).post('/api/auth/otp/verify').send({ challengeId: 'x', code: 'y' });
    await request(app).get('/api/nope');

    const log = output();

    // Sanity: the log is not empty, and the security events we do want are there.
    expect(log).toContain('User signed in');
    expect(log).toContain('Refresh token reuse detected');

    const secrets = [
      first.code,
      codeSentTo(sms, phone),
      signedIn.accessToken,
      signedIn.refreshToken,
      refreshed.accessToken,
      refreshed.refreshToken,
      phone,
    ];
    for (const secret of secrets) {
      expect(log).not.toContain(secret);
    }
  });

  it('redacts the Authorization header if it is ever logged', async () => {
    const { logger, output } = capturingLogger();
    const { app } = buildTestApp({ db, logger });

    // A 404 is logged by the request logger, including request headers.
    await request(app).get('/api/nope').set('Authorization', 'Bearer super-secret-token-value');

    expect(output()).toContain('/api/nope');
    expect(output()).not.toContain('super-secret-token-value');
  });

  it('redacts token fields anywhere in a logged object', () => {
    const { logger, output } = capturingLogger();

    logger.info({ session: { accessToken: 'AAA-visible?', refreshToken: 'RRR-visible?' } }, 'x');

    expect(output()).not.toContain('AAA-visible?');
    expect(output()).not.toContain('RRR-visible?');
    expect(output()).toContain('[redacted]');
  });
});

describe('MockSmsProvider (development delivery)', () => {
  it('prints the message so a developer can read the OTP, and only when given a logger', async () => {
    const { logger, output } = capturingLogger();
    const withLogger = new MockSmsProvider(logger);
    const silent = new MockSmsProvider();

    await withLogger.send({ to: '+94771234567', body: 'Your code is 424242' });
    await silent.send({ to: '+94771234567', body: 'Your code is 424242' });

    expect(output()).toContain('424242');
    expect(withLogger.lastCodeTo('+94771234567')).toBe('424242');
    expect(silent.sent).toHaveLength(1);
  });
});
