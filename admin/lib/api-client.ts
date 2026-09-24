/**
 * The only thing in this app that talks to the backend. Every call goes
 * straight from the browser to the API's own origin with the session cookie
 * (`credentials: 'include'`) — there is no server-side proxy here, so the
 * Next.js server itself never sees or needs the admin's session. See
 * `server/src/modules/admin`'s own doc comment: authorization is decided
 * there, on every request, regardless of anything this file does.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

const SAFE_METHODS = new Set(['GET', 'HEAD']);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Reads one cookie from `document.cookie`. Only ever called client-side (the CSRF cookie is not HttpOnly on purpose — see the backend's `cookies.ts`). */
function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

/**
 * Calls the admin API. Throws {@link ApiError} for any non-2xx response,
 * parsed from the backend's standard `{ error: { code, message } }` body —
 * callers switch on `.code`, never on the (unlocalized, backend-authored)
 * `.message` text for anything user-facing.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!SAFE_METHODS.has(method)) {
    const csrfToken = readCookie('admin_csrf');
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  const data: unknown = contentType.includes('application/json') ? await res.json() : undefined;

  if (!res.ok) {
    const body = data as
      | {
          error?: {
            code?: string;
            message?: string;
            details?: { path: string; message: string }[];
          };
        }
      | undefined;
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'UNKNOWN_ERROR',
      body?.error?.message ?? `Request failed with status ${res.status}.`,
      body?.error?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ?? {} }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
