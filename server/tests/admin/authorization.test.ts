import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createAdminUser, errorOf, signInAdmin } from '../helpers/admin.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { signInUser } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;
afterAll(() => handle.close());

let t: TestApp;
beforeEach(async () => {
  await resetDatabase(db);
  t = buildTestApp({ db });
});

const ADMIN_GET_PATHS = [
  '/api/admin/dashboard',
  '/api/admin/providers',
  '/api/admin/categories',
  '/api/admin/bookings',
  '/api/admin/payments',
  '/api/admin/payouts',
  '/api/admin/reviews',
  '/api/admin/users',
  '/api/admin/audit-log',
];

describe('every admin route is server-enforced authorization, not something the frontend decides', () => {
  it.each(ADMIN_GET_PATHS)('401s for %s with no session cookie at all', async (path) => {
    const res = await request(t.app).get(path);
    expect(res.status).toBe(401);
  });

  it.each(ADMIN_GET_PATHS)(
    'authorization: 401s for %s for a regular signed-in customer/provider (a mobile Bearer token carries no admin weight)',
    async (path) => {
      const { api } = await signInUser(t.app, t.sms);
      const res = await api.get(path);
      expect(res.status).toBe(401);
    },
  );

  it('401s for a forged/garbage session cookie', async () => {
    const res = await request(t.app)
      .get('/api/admin/dashboard')
      .set('Cookie', 'admin_session=not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('a valid admin session works for every listed route', async () => {
    const { api } = await signInAdmin(t.app, db);
    for (const path of ADMIN_GET_PATHS) {
      const res = await api.get(path);
      expect(res.status, path).not.toBe(401);
    }
  });
});

describe('CSRF protection on mutating admin requests', () => {
  it('403s a mutation made with the session cookie but no CSRF header (a forged cross-site request cannot echo a cookie it cannot read)', async () => {
    const admin = await createAdminUser(db);
    const agent = request.agent(t.app);
    await agent
      .post('/api/admin/auth/login')
      .send({ email: admin.email, password: admin.password });

    // The agent carries the session cookie automatically; deliberately not
    // setting X-CSRF-Token, unlike the `signInAdmin` test helper.
    const res = await agent
      .post('/api/admin/categories')
      .send({ slug: 'no-csrf', name: 'No CSRF', pricingModel: 'quote' });
    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('CSRF_TOKEN_INVALID');
  });

  it('403s a mutation whose CSRF header does not match the cookie', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api
      .post('/api/admin/categories')
      .set('X-CSRF-Token', 'a-completely-wrong-value')
      .send({ slug: 'x', name: 'X', pricingModel: 'quote' });
    expect(res.status).toBe(403);
  });

  it('GET requests never require a CSRF header', async () => {
    const { api } = await signInAdmin(t.app, db);
    expect((await api.get('/api/admin/dashboard')).status).not.toBe(403);
  });

  it('a correctly-echoed CSRF header succeeds', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.post('/api/admin/categories', {
      slug: 'csrf-ok',
      name: 'CSRF OK',
      pricingModel: 'quote',
    });
    expect(res.status).toBe(201);
  });
});
