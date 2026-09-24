import type { Request, RequestHandler } from 'express';

import { AppError, ErrorCode } from '../../lib/errors.js';
import type { SessionService } from './session.service.js';
import type { AccessTokenService } from './token.service.js';

/** Who is making an authenticated request. */
export interface AuthContext {
  userId: string;
  sessionId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth`. Use {@link getAuth} to read it. */
    auth?: AuthContext;
  }
}

/**
 * Returns the authenticated caller. Handlers behind `requireAuth` use this
 * instead of reading `req.auth` directly, so there is no optional value to
 * forget to check. Throws 401 if the middleware was not applied.
 */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}

/** One response for every kind of bad credential (missing, malformed, forged, expired, revoked). */
function unauthenticated(): AppError {
  return new AppError(401, ErrorCode.Unauthenticated, 'Authentication required.', {
    headers: { 'WWW-Authenticate': 'Bearer' },
  });
}

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

export interface RequireAuthDeps {
  accessTokens: AccessTokenService;
  sessions: SessionService;
}

/** Turns a bare access token string into who it belongs to. Used by anything that is not an HTTP request. */
export type Authenticator = (token: string) => Promise<AuthContext>;

/**
 * The actual rule behind `requireAuth`, without the Express plumbing: only a
 * valid access token whose session is still active in the database and whose
 * user is allowed to sign in resolves. Shared by HTTP (`createRequireAuth`)
 * and anything else that authenticates a caller from a bare token (the
 * realtime module's socket handshake), so the rule is never re-implemented.
 *
 * Why the database check: a signed token cannot be recalled, so without it a
 * logged-out or revoked session would keep working until the token expired.
 */
export function createAuthenticate({ accessTokens, sessions }: RequireAuthDeps): Authenticator {
  return async (token) => {
    let claims;
    try {
      claims = await accessTokens.verify(token);
    } catch {
      // The reason (expired, forged, wrong algorithm...) is deliberately not exposed.
      throw unauthenticated();
    }

    const session = await sessions.checkSession(claims.sessionId, claims.userId);
    if (!session.ok) {
      if (session.reason === 'suspended') {
        throw new AppError(403, ErrorCode.AccountSuspended, 'This account is suspended.');
      }
      throw unauthenticated();
    }

    return { userId: claims.userId, sessionId: claims.sessionId };
  };
}

/**
 * Protects a route. It accepts only a valid access token whose session is
 * still active in the database and whose user is allowed to sign in, and on
 * success sets `req.auth`.
 */
export function createRequireAuth(deps: RequireAuthDeps): RequestHandler {
  const authenticate = createAuthenticate(deps);
  return async (req, _res, next) => {
    const token = BEARER_PATTERN.exec(req.headers.authorization ?? '')?.[1];
    if (!token) throw unauthenticated();
    req.auth = await authenticate(token);
    next();
  };
}
