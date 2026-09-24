import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { adminAuditLog } from '../../src/db/schema/index.js';
import { bodyOf, errorOf, itemsOf, signInAdmin } from '../helpers/admin.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
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

describe('user management', () => {
  it('lists users, searchable by phone', async () => {
    const { phone } = await signInUser(t.app, t.sms);
    const { api } = await signInAdmin(t.app, db);

    const res = await api.get(`/api/admin/users?q=${encodeURIComponent(phone)}`);
    expect(res.status).toBe(200);
    expect(itemsOf<{ phoneE164: string }>(res).some((u) => u.phoneE164 === phone)).toBe(true);
  });

  it('shows a single user by id', async () => {
    const { userId } = await signInUser(t.app, t.sms);
    const { api } = await signInAdmin(t.app, db);
    const res = await api.get(`/api/admin/users/${userId}`);
    expect(res.status).toBe(200);
    const body = bodyOf<{ id: string; status: string }>(res);
    expect(body.id).toBe(userId);
    expect(body.status).toBe('active');
  });

  it('404s for a user that does not exist', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.get('/api/admin/users/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  it('suspends a user: their existing session is rejected immediately, and it is audit-logged', async () => {
    const { userId, api: userApi } = await signInUser(t.app, t.sms);
    expect((await userApi.get('/api/auth/me')).status).toBe(200);

    const { admin, api } = await signInAdmin(t.app, db);
    const res = await api.post(`/api/admin/users/${userId}/suspend`, {
      reason: 'Fraudulent activity',
    });
    expect(res.status).toBe(200);
    expect(bodyOf<{ status: string }>(res).status).toBe('suspended');

    // The existing session's access token is now rejected — see auth.middleware.ts's DB check.
    const rejected = await userApi.get('/api/auth/me');
    expect(rejected.status).toBe(403);
    expect(errorOf(rejected).code).toBe('ACCOUNT_SUSPENDED');

    const [entry] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, userId));
    expect(entry).toMatchObject({
      adminUserId: admin.id,
      action: 'user_suspended',
      targetType: 'user',
      details: { reason: 'Fraudulent activity' },
    });
  });

  it('requires a reason to suspend', async () => {
    const { userId } = await signInUser(t.app, t.sms);
    const { api } = await signInAdmin(t.app, db);
    const res = await api.post(`/api/admin/users/${userId}/suspend`, {});
    expect(res.status).toBe(400);
  });

  it('reactivates a suspended user, letting them sign in again', async () => {
    const { userId, phone } = await signInUser(t.app, t.sms);
    const { api } = await signInAdmin(t.app, db);
    await api.post(`/api/admin/users/${userId}/suspend`, { reason: 'x' });

    const reactivated = await api.post(`/api/admin/users/${userId}/reactivate`);
    expect(reactivated.status).toBe(200);
    expect(bodyOf<{ status: string }>(reactivated).status).toBe('active');

    t.clock.advanceSeconds(61); // past the OTP resend cooldown for this same phone
    const { api: newSession } = await signInUser(t.app, t.sms, phone);
    expect((await newSession.get('/api/auth/me')).status).toBe(200);
  });

  it('filters by status', async () => {
    const { userId } = await signInUser(t.app, t.sms);
    await signInUser(t.app, t.sms);
    const { api } = await signInAdmin(t.app, db);
    await api.post(`/api/admin/users/${userId}/suspend`, { reason: 'x' });

    const res = await api.get('/api/admin/users?status=suspended');
    expect(res.status).toBe(200);
    const items = itemsOf<{ id: string }>(res);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(userId);
  });
});
