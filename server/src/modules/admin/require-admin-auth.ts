import type { Request, RequestHandler } from 'express';

import { AppError, ErrorCode } from '../../lib/errors.js';
import type { AdminSessionService } from './admin-session.service.js';
import { readCookie, SESSION_COOKIE } from './cookies.js';
import type { AdminTokenService } from './admin-token.service.js';

/** Who is making an authenticated admin request. */
export interface AdminAuthContext {
  adminUserId: string;
  sessionId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAdminAuth`. Use {@link getAdminAuth} to read it. */
    admin?: AdminAuthContext;
  }
}

/** Throws 401 if `requireAdminAuth` was not applied ahead of this handler. */
export function getAdminAuth(req: Request): AdminAuthContext {
  if (!req.admin) throw unauthenticated();
  return req.admin;
}

function unauthenticated(): AppError {
  return new AppError(401, ErrorCode.Unauthenticated, 'Admin authentication required.');
}

export interface RequireAdminAuthDeps {
  tokens: AdminTokenService;
  sessions: AdminSessionService;
}

/**
 * Protects every `/api/admin` route (see `admin/index.ts`). Reads the
 * session from an HttpOnly cookie, never a header a script could set — this
 * is the actual authorization boundary; nothing in the Next.js admin app is
 * ever trusted to decide who is an admin on its own (its own middleware only
 * redirects for a nicer UX — see `admin/middleware.ts` there).
 *
 * Like the mobile app's `requireAuth`, a valid signature alone is not
 * enough: the session must still be active in `admin_sessions`, so a logout
 * or revocation takes effect immediately rather than when the token expires.
 */
export function createRequireAdminAuth({ tokens, sessions }: RequireAdminAuthDeps): RequestHandler {
  return async (req, _res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) throw unauthenticated();

    let claims;
    try {
      claims = await tokens.verify(token);
    } catch {
      throw unauthenticated();
    }

    const session = await sessions.checkSession(claims.sessionId, claims.adminUserId);
    if (!session.ok) throw unauthenticated();

    req.admin = { adminUserId: claims.adminUserId, sessionId: claims.sessionId };
    next();
  };
}
