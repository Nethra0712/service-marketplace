import { Router, type RequestHandler } from 'express';

import { parseRequest } from '../../lib/validation.js';
import { createIpRateLimiter } from '../../middleware/ip-rate-limit.js';
import type { AuthPolicy } from './auth.policy.js';
import { getAuth } from './auth.middleware.js';
import type { AuthSchemas } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import type { OtpService } from './otp.service.js';
import type { AuthTokens, SessionService } from './session.service.js';

export interface AuthRoutesDeps {
  otp: OtpService;
  auth: AuthService;
  sessions: SessionService;
  schemas: AuthSchemas;
  policy: AuthPolicy;
  requireAuth: RequestHandler;
}

/** The token response shape shared by sign-in and refresh. */
function tokenResponse(tokens: AuthTokens) {
  return { tokenType: 'Bearer' as const, ...tokens };
}

/** Mounted at /api/auth. */
export function createAuthRouter({
  otp,
  auth,
  sessions,
  schemas,
  policy,
  requireAuth,
}: AuthRoutesDeps): Router {
  const router = Router();

  // Nothing here may be cached by a browser, proxy or HTTP client.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const limitOtpRequest = createIpRateLimiter(policy.rateLimits.otpRequest);
  const limitOtpVerify = createIpRateLimiter(policy.rateLimits.otpVerify);
  const limitRefresh = createIpRateLimiter(policy.rateLimits.refresh);

  // Step 1: ask for a code. Identical response whether or not the phone has an account.
  router.post('/otp/request', limitOtpRequest, async (req, res) => {
    const { body } = parseRequest(schemas.otpRequest, req);
    res.status(202).json(await otp.requestOtp(body.phone));
  });

  // Step 2: submit the code. Creates the account on first success.
  router.post('/otp/verify', limitOtpVerify, async (req, res) => {
    const { body } = parseRequest(schemas.otpVerify, req);
    res.json(tokenResponse(await auth.verifyOtp(body.challengeId, body.code)));
  });

  router.post('/refresh', limitRefresh, async (req, res) => {
    const { body } = parseRequest(schemas.refresh, req);
    res.json(tokenResponse(await sessions.refresh(body.refreshToken)));
  });

  // Takes the refresh token (not the access token) so a client whose access
  // token has expired can still sign out. Always 204.
  router.post('/logout', limitRefresh, async (req, res) => {
    const { body } = parseRequest(schemas.logout, req);
    await sessions.logout(body.refreshToken);
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    res.json(await auth.getCurrentUser(getAuth(req).userId));
  });

  return router;
}
