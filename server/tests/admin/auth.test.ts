import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_SESSION_TTL_SECONDS } from '../../src/modules/admin/index.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createAdminUser, errorOf, signInAdmin } from '../helpers/admin.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';

const handle = createTestDatabase();
const { db } = handle;
afterAll(() => handle.close());

let t: TestApp;
beforeEach(async () => {
  await resetDatabase(db);
  t = buildTestApp({ db });
});

describe('POST /api/admin/auth/login', () => {
  it('signs an admin in and sets an HttpOnly session cookie plus a readable CSRF cookie', async () => {
    const admin = await createAdminUser(db, {
      email: 'owner@example.test',
      password: 'a-real-password-123',
    });
    const res = await request(t.app)
      .post('/api/admin/auth/login')
      .send({ email: admin.email, password: admin.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ admin: { email: admin.email, fullName: admin.fullName } });
    // Never leaked back to the client.
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain(admin.password);

    const cookies = ([res.headers['set-cookie']].flat() as string[]).join('\n');
    expect(cookies).toMatch(/admin_session=.+HttpOnly/i);
    expect(cookies).toMatch(/admin_csrf=/i);
    expect(cookies).not.toMatch(/admin_csrf=[^\n]*HttpOnly/i);
  });

  it('rejects a wrong password with a generic message', async () => {
    const admin = await createAdminUser(db, { email: 'owner@example.test' });
    const res = await request(t.app)
      .post('/api/admin/auth/login')
      .send({ email: admin.email, password: 'not-the-real-password' });
    expect(res.status).toBe(401);
    expect(errorOf(res).code).toBe('INVALID_ADMIN_CREDENTIALS');
  });

  it('rejects an email that does not belong to any admin, with the identical error', async () => {
    const res = await request(t.app)
      .post('/api/admin/auth/login')
      .send({ email: 'nobody@example.test', password: 'whatever-password-123' });
    expect(res.status).toBe(401);
    expect(errorOf(res).code).toBe('INVALID_ADMIN_CREDENTIALS');
  });

  it('rate-limits repeated login attempts', async () => {
    const admin = await createAdminUser(db, { email: 'owner@example.test' });
    let last: request.Response | undefined;
    for (let i = 0; i < 15; i += 1) {
      last = await request(t.app)
        .post('/api/admin/auth/login')
        .send({ email: admin.email, password: 'wrong' });
    }
    expect(last?.status).toBe(429);
  });
});

describe('account lockout after repeated failed logins', () => {
  // A distinct X-Forwarded-For per request keeps this isolated from the
  // per-IP login limiter (also 10/15min — see `admin-auth.service.ts`'s own
  // doc comment on why the two thresholds match), so what's being proven
  // here is specifically the per-ACCOUNT lockout, not the IP one.
  let spoofed: TestApp;
  let ipCounter = 0;
  beforeEach(() => {
    spoofed = buildTestApp({ db, config: { trustProxyHops: 1 } });
  });
  function attempt(email: string, password: string) {
    ipCounter += 1;
    return request(spoofed.app)
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', `10.0.0.${ipCounter.toString()}`)
      .send({ email, password });
  }

  it('locks the account after enough failed attempts, even with the correct password', async () => {
    const admin = await createAdminUser(db, { email: 'owner@example.test' });
    for (let i = 0; i < 10; i += 1) {
      expect((await attempt(admin.email, 'wrong')).status).toBe(401);
    }

    const res = await attempt(admin.email, admin.password);
    expect(res.status).toBe(401);
    expect(errorOf(res).code).toBe('INVALID_ADMIN_CREDENTIALS');
  });

  it('does not lock out before the threshold: the correct password still works', async () => {
    const admin = await createAdminUser(db, { email: 'owner@example.test' });
    for (let i = 0; i < 9; i += 1) {
      expect((await attempt(admin.email, 'wrong')).status).toBe(401);
    }

    expect((await attempt(admin.email, admin.password)).status).toBe(200);
  });

  it('unlocks after the lockout window passes', async () => {
    const admin = await createAdminUser(db, { email: 'owner@example.test' });
    for (let i = 0; i < 10; i += 1) {
      await attempt(admin.email, 'wrong');
    }
    expect((await attempt(admin.email, admin.password)).status).toBe(401);

    spoofed.clock.advanceSeconds(15 * 60 + 1);

    expect((await attempt(admin.email, admin.password)).status).toBe(200);
  });

  it('a successful login resets the failed-attempt count', async () => {
    const admin = await createAdminUser(db, { email: 'owner@example.test' });
    for (let i = 0; i < 5; i += 1) {
      expect((await attempt(admin.email, 'wrong')).status).toBe(401);
    }
    expect((await attempt(admin.email, admin.password)).status).toBe(200);

    // Back to a fresh count: 9 more failures still isn't the 10-attempt threshold.
    for (let i = 0; i < 9; i += 1) {
      expect((await attempt(admin.email, 'wrong')).status).toBe(401);
    }
    expect((await attempt(admin.email, admin.password)).status).toBe(200);
  });
});

describe('GET /api/admin/auth/me', () => {
  it("returns the signed-in admin's own identity", async () => {
    const { admin, api } = await signInAdmin(t.app, db, { email: 'me@example.test' });
    const res = await api.get('/api/admin/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ admin: { id: admin.id, email: admin.email } });
  });

  it('401s without a session cookie', async () => {
    const res = await request(t.app).get('/api/admin/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('session expiry', () => {
  it('rejects a session once its lifetime has elapsed, even though it was never revoked', async () => {
    const { api } = await signInAdmin(t.app, db);
    expect((await api.get('/api/admin/auth/me')).status).toBe(200);

    t.clock.advanceSeconds(ADMIN_SESSION_TTL_SECONDS + 1);

    expect((await api.get('/api/admin/auth/me')).status).toBe(401);
  });

  it('still works normally just before expiry', async () => {
    const { api } = await signInAdmin(t.app, db);

    t.clock.advanceSeconds(ADMIN_SESSION_TTL_SECONDS - 1);

    expect((await api.get('/api/admin/auth/me')).status).toBe(200);
  });
});

describe('POST /api/admin/auth/logout', () => {
  it('revokes the session so it is immediately rejected afterwards', async () => {
    const { api } = await signInAdmin(t.app, db);
    expect((await api.get('/api/admin/auth/me')).status).toBe(200);

    const logoutRes = await api.post('/api/admin/auth/logout');
    expect(logoutRes.status).toBe(204);

    expect((await api.get('/api/admin/auth/me')).status).toBe(401);
  });

  it('requires a valid CSRF token, like every other mutating admin route', async () => {
    const admin = await createAdminUser(db);
    const agent = request.agent(t.app);
    await agent
      .post('/api/admin/auth/login')
      .send({ email: admin.email, password: admin.password });

    // The agent carries the session cookie automatically; deliberately not
    // setting X-CSRF-Token, same as `authorization.test.ts`'s CSRF suite.
    const res = await agent.post('/api/admin/auth/logout');
    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('CSRF_TOKEN_INVALID');

    // The session is still alive: the missing-CSRF request never logged it out.
    expect((await agent.get('/api/admin/auth/me')).status).toBe(200);
  });
});
