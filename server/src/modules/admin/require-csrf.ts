import type { RequestHandler } from 'express';

import { safeEqual } from '../../lib/crypto.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import { CSRF_COOKIE, readCookie } from './cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection for the cookie-authenticated admin API.
 * SameSite=Strict on the session cookie (see `cookies.ts`) already blocks
 * most cross-site requests, but this is defence in depth for the cases it
 * does not cover (an older browser, a same-site subdomain, a misconfigured
 * proxy). Every mutating request must echo the CSRF cookie's value back in
 * an `X-CSRF-Token` header — something only JavaScript running on this
 * app's own origin can read.
 */
export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = readCookie(req, CSRF_COOKIE);
  const headerToken = req.headers['x-csrf-token'];
  if (
    !cookieToken ||
    typeof headerToken !== 'string' ||
    !headerToken ||
    !safeEqual(cookieToken, headerToken)
  ) {
    throw new AppError(403, ErrorCode.CsrfTokenInvalid, 'Missing or invalid CSRF token.');
  }
  next();
};
