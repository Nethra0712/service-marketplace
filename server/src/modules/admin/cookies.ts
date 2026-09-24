import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'admin_session';
export const CSRF_COOKIE = 'admin_csrf';

/** Everything under /api/admin, and nowhere else — these cookies are meaningless anywhere else in the API. */
const COOKIE_PATH = '/api/admin';

/**
 * Reads one cookie from the raw `Cookie` header. No `cookie-parser`
 * dependency: the format is simple enough (`name=value; name=value`) that
 * parsing it by hand is a few lines, and this is the only place in the app
 * that needs to.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined; // Malformed percent-encoding: treat as no cookie.
    }
  }
  return undefined;
}

/**
 * Sets the session cookie: HttpOnly (never readable by page JavaScript, so
 * an XSS cannot steal it directly) and, outside development, Secure
 * (HTTPS-only) with SameSite=Strict (never sent on a cross-site request,
 * the first line of CSRF defence — `require-csrf.ts` is the second, for the
 * requests SameSite alone cannot cover).
 */
export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date,
  isProduction: boolean,
): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

/**
 * The CSRF cookie is deliberately NOT HttpOnly: the admin app's own
 * JavaScript reads it and echoes it back in a request header (the
 * double-submit pattern — see `require-csrf.ts`). Its secrecy is not what
 * protects anything; a cross-site page could read it too, but could never
 * also set the matching header, since it cannot read cookies belonging to
 * this origin.
 */
export function setCsrfCookie(res: Response, token: string, isProduction: boolean): void {
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'strict',
    path: COOKIE_PATH,
  });
}

export function clearAdminCookies(res: Response, isProduction: boolean): void {
  const options = { path: COOKIE_PATH, secure: isProduction, sameSite: 'strict' as const };
  res.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}
