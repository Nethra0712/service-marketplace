import type { Express } from 'express';
import request from 'supertest';

import type { Database } from '../../src/db/client.js';
import { adminUsers, type AdminUser } from '../../src/db/schema/index.js';
import { hashPassword } from '../../src/lib/password.js';

let adminCounter = 0;

/** An admin response body, typed instead of `any` (supertest leaves `.body` untyped). */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is the caller-specified cast target, deliberately not inferred from a parameter.
export const bodyOf = <T>(res: { body: unknown }): T => res.body as T;

/** An `{ items: [...] }` list response body, typed. */
export const itemsOf = <T>(res: { body: unknown }): T[] => (res.body as { items: T[] }).items;

/** An `{ error: {...} }` response body, typed. */
export interface AdminErrorBody {
  code: string;
  message: string;
}
export const errorOf = (res: { body: unknown }): AdminErrorBody =>
  (res.body as { error: AdminErrorBody }).error;

export interface AdminFixture extends AdminUser {
  password: string;
}

/** Inserts an admin row directly — mirrors what `npm run admin:create` does. */
export async function createAdminUser(
  db: Database,
  overrides: { email?: string; password?: string; fullName?: string } = {},
): Promise<AdminFixture> {
  adminCounter += 1;
  const email = overrides.email ?? `admin-${adminCounter}@example.test`;
  const password = overrides.password ?? 'a-genuinely-long-test-password-1';
  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(adminUsers)
    .values({ email, passwordHash, fullName: overrides.fullName ?? 'Test Admin' })
    .returning();
  if (!row) throw new Error('Admin insert returned no row');
  return { ...row, password };
}

function cookieValue(setCookie: string[] | undefined, name: string): string | undefined {
  if (!setCookie) return undefined;
  for (const line of setCookie) {
    const match = new RegExp(`^${name}=([^;]+)`).exec(line);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return undefined;
}

export interface AdminApi {
  get: (path: string) => request.Test;
  post: (path: string, body?: object) => request.Test;
  patch: (path: string, body?: object) => request.Test;
  del: (path: string) => request.Test;
  /** The CSRF cookie's raw value, for tests that deliberately omit/forge the header. */
  csrfToken: string | undefined;
}

/** Signs an admin in through the real HTTP login flow and returns a cookie-jar-backed client that also attaches the CSRF header on mutating calls. */
export async function signInAdmin(
  app: Express,
  db: Database,
  overrides: { email?: string; password?: string; fullName?: string } = {},
): Promise<{ admin: AdminFixture; api: AdminApi }> {
  const admin = await createAdminUser(db, overrides);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/admin/auth/login')
    .send({ email: admin.email, password: admin.password });
  if (res.status !== 200) {
    throw new Error(`admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const csrfToken = cookieValue(res.headers['set-cookie'] as string[] | undefined, 'admin_csrf');
  const withCsrf = (test: request.Test) => (csrfToken ? test.set('X-CSRF-Token', csrfToken) : test);

  return {
    admin,
    api: {
      get: (path) => agent.get(path),
      post: (path, body = {}) => withCsrf(agent.post(path).send(body)),
      patch: (path, body = {}) => withCsrf(agent.patch(path).send(body)),
      del: (path) => withCsrf(agent.delete(path)),
      csrfToken,
    },
  };
}
