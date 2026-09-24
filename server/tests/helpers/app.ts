import type { Express } from 'express';

import { createApp, type RealtimeDependencies } from '../../src/app.js';
import type { AppConfig } from '../../src/config/env.js';
import type { Database } from '../../src/db/client.js';
import type { Clock } from '../../src/lib/clock.js';
import { createLogger, type Logger } from '../../src/lib/logger.js';
import type { RateLimitPolicy } from '../../src/middleware/ip-rate-limit.js';
import type { AuthPolicy } from '../../src/modules/auth/index.js';
import { MockSmsProvider, type SmsProvider } from '../../src/modules/sms/index.js';

export type TestConfig = Pick<
  AppConfig,
  | 'corsOrigins'
  | 'jwtAccessSecret'
  | 'otpHmacSecret'
  | 'allowedPhoneCountryCodes'
  | 'trustProxyHops'
  | 'nodeEnv'
  | 'paymentProvider'
  | 'platformCommissionBasisPoints'
  | 'publicApiBaseUrl'
  | 'payhere'
  | 'pushProvider'
  | 'fcm'
  | 'adminJwtSecret'
>;

// Fixed, obviously fake secrets. They exist only in the test suite.
export const TEST_JWT_SECRET = 'test-only-jwt-secret-0123456789-abcdefghijklmnop';
export const TEST_OTP_SECRET = 'test-only-otp-secret-9876543210-ponmlkjihgfedcba';
export const TEST_ADMIN_JWT_SECRET = 'test-only-admin-secret-1122334455-qrstuvwxyzab';

export const testConfig: TestConfig = {
  corsOrigins: [],
  jwtAccessSecret: TEST_JWT_SECRET,
  otpHmacSecret: TEST_OTP_SECRET,
  allowedPhoneCountryCodes: ['94'],
  trustProxyHops: 0,
  nodeEnv: 'test',
  paymentProvider: 'mock',
  platformCommissionBasisPoints: 1500,
  publicApiBaseUrl: 'http://localhost:3000',
  payhere: undefined,
  pushProvider: 'mock',
  fcm: undefined,
  adminJwtSecret: TEST_ADMIN_JWT_SECRET,
};

/** A clock tests can move forward, so expiry is tested without sleeping. */
export class FakeClock {
  private time = Date.now();

  readonly now: Clock = () => new Date(this.time);

  advanceSeconds(seconds: number): void {
    this.time += seconds * 1000;
  }
}

export interface TestAppOptions {
  db: Database;
  config?: Partial<TestConfig>;
  authPolicy?: Partial<AuthPolicy>;
  catalogueRateLimit?: RateLimitPolicy;
  pingDatabase?: () => Promise<void>;
  /** Replaces the default in-memory mock, e.g. with one that always fails. */
  smsOverride?: SmsProvider;
  logger?: Logger;
}

export interface TestApp {
  app: Express;
  /** Records every SMS the default provider was asked to send. */
  sms: MockSmsProvider;
  clock: FakeClock;
  /** What the realtime module needs from this app instance, for tests that build one on top of it. */
  realtime: RealtimeDependencies;
}

export function buildTestApp({
  db,
  config,
  authPolicy,
  catalogueRateLimit,
  pingDatabase = () => Promise.resolve(),
  smsOverride,
  logger = createLogger({ logLevel: 'silent' }),
}: TestAppOptions): TestApp {
  const sms = new MockSmsProvider();
  const clock = new FakeClock();
  const { app, realtime } = createApp({
    config: { ...testConfig, ...config },
    logger,
    db,
    pingDatabase,
    sms: smsOverride ?? sms,
    clock: clock.now,
    authPolicy,
    catalogueRateLimit,
  });
  return { app, sms, clock, realtime };
}
