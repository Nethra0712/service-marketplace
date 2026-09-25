import { Router, type RequestHandler } from 'express';

import { createIpRateLimiter, type RateLimitPolicy } from '../../middleware/ip-rate-limit.js';
import { parseRequest } from '../../lib/validation.js';
import type { AdminAuthService } from './admin-auth.service.js';
import { adminAuthSchemas } from './admin-auth.schemas.js';
import { clearAdminCookies, setCsrfCookie, setSessionCookie } from './cookies.js';
import { getAdminAuth } from './require-admin-auth.js';
import { requireCsrf } from './require-csrf.js';
import { randomToken } from '../../lib/crypto.js';

export interface AdminAuthRoutesDeps {
  service: AdminAuthService;
  requireAdminAuth: RequestHandler;
  isProduction: boolean;
  loginRateLimit: RateLimitPolicy;
}

/**
 * Admin sign-in. Deliberately no self-registration endpoint here — accounts
 * are created only by `npm run dev:create-admin` (see that script's doc
 * comment), so nothing on the public internet can ever create an admin
 * account.
 *
 *   POST /login    email + password -> session cookie + CSRF cookie
 *   POST /logout   revokes the session, clears both cookies (CSRF-protected
 *                  like every other mutating admin route, even though
 *                  SameSite=Strict already keeps the session cookie itself
 *                  from ever reaching a cross-site request)
 *   GET  /me        the caller's own admin identity
 */
export function createAdminAuthRouter({
  service,
  requireAdminAuth,
  isProduction,
  loginRateLimit,
}: AdminAuthRoutesDeps): Router {
  const router = Router();
  const limitLogin = createIpRateLimiter(loginRateLimit);

  router.post('/login', limitLogin, async (req, res) => {
    const { body } = parseRequest(adminAuthSchemas.login, req);
    const { admin, token, expiresAt } = await service.login(body.email, body.password);

    setSessionCookie(res, token, expiresAt, isProduction);
    setCsrfCookie(res, randomToken(24), isProduction);
    res.json({ admin });
  });

  router.post('/logout', requireAdminAuth, requireCsrf, async (req, res) => {
    await service.logout(getAdminAuth(req).sessionId);
    clearAdminCookies(res, isProduction);
    res.status(204).send();
  });

  router.get('/me', requireAdminAuth, async (req, res) => {
    res.json({ admin: await service.getIdentity(getAdminAuth(req).adminUserId) });
  });

  return router;
}
