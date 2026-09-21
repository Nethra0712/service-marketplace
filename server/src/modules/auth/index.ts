import type { RequestHandler, Router } from 'express';

import type { AppConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import type { Logger } from '../../lib/logger.js';
import type { SmsProvider } from '../sms/index.js';
import { defaultAuthPolicy, type AuthPolicy } from './auth.policy.js';
import { createRequireAuth } from './auth.middleware.js';
import { createAuthRouter } from './auth.routes.js';
import { createAuthSchemas } from './auth.schemas.js';
import { createAuthService, type AuthService } from './auth.service.js';
import { createOtpService } from './otp.service.js';
import { createSessionService } from './session.service.js';
import { createAccessTokenService } from './token.service.js';

export { defaultAuthPolicy, type AuthPolicy } from './auth.policy.js';
export { getAuth, type AuthContext } from './auth.middleware.js';
export { purgeExpiredAuthData } from './cleanup.service.js';

export interface AuthModuleDeps {
  db: Database;
  sms: SmsProvider;
  logger: Logger;
  clock: Clock;
  /** Overrides individual policy values (tests use this for tiny limits). */
  policy?: Partial<AuthPolicy>;
  config: Pick<AppConfig, 'jwtAccessSecret' | 'otpHmacSecret' | 'allowedPhoneCountryCodes'>;
}

export interface AuthModule {
  /** Mount at /api/auth. */
  router: Router;
  /** Protects any route: rejects unauthenticated callers and sets the auth context. */
  requireAuth: RequestHandler;
  service: AuthService;
}

/** The auth module's public surface: other modules import from here only. */
export function createAuthModule({
  db,
  sms,
  logger,
  clock,
  policy,
  config,
}: AuthModuleDeps): AuthModule {
  const effectivePolicy: AuthPolicy = { ...defaultAuthPolicy, ...policy };

  const accessTokens = createAccessTokenService({
    secret: config.jwtAccessSecret,
    ttlSeconds: effectivePolicy.accessTokenTtlSeconds,
    clock,
  });
  const otp = createOtpService({
    db,
    sms,
    clock,
    policy: effectivePolicy,
    hmacSecret: config.otpHmacSecret,
  });
  const sessions = createSessionService({
    db,
    clock,
    policy: effectivePolicy,
    accessTokens,
    logger,
  });
  const service = createAuthService({ db, otp, sessions, logger });
  const requireAuth = createRequireAuth({ accessTokens, sessions });

  const router = createAuthRouter({
    otp,
    auth: service,
    sessions,
    schemas: createAuthSchemas(config.allowedPhoneCountryCodes),
    policy: effectivePolicy,
    requireAuth,
  });

  return { router, requireAuth, service };
}
