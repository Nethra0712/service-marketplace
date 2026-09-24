import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

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

describe('POST /api/admin/auth/logout', () => {
  it('revokes the session so it is immediately rejected afterwards', async () => {
    const { api } = await signInAdmin(t.app, db);
    expect((await api.get('/api/admin/auth/me')).status).toBe(200);

    const logoutRes = await api.post('/api/admin/auth/logout');
    expect(logoutRes.status).toBe(204);

    expect((await api.get('/api/admin/auth/me')).status).toBe(401);
  });
});
