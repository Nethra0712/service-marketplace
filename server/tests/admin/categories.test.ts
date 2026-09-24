import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { adminAuditLog } from '../../src/db/schema/index.js';
import { bodyOf, itemsOf, signInAdmin } from '../helpers/admin.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';

const handle = createTestDatabase();
const { db } = handle;
afterAll(() => handle.close());

let t: TestApp;
beforeEach(async () => {
  await resetDatabase(db);
  t = buildTestApp({ db });
});

describe('category management', () => {
  it('creates a category and records an audit log entry', async () => {
    const { admin, api } = await signInAdmin(t.app, db);
    const res = await api.post('/api/admin/categories', {
      slug: 'gardening',
      name: 'Gardening',
      description: 'Lawn care and landscaping.',
      pricingModel: 'hourly',
      baseRate: 1200,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      slug: 'gardening',
      pricingModel: 'hourly',
      baseRate: '1200.00',
      isActive: true,
    });

    const { id } = bodyOf<{ id: string }>(res);
    const [entry] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, id));
    expect(entry).toMatchObject({ adminUserId: admin.id, action: 'category_created' });
  });

  it('rejects a fixed/hourly category with no baseRate', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.post('/api/admin/categories', {
      slug: 'x',
      name: 'X',
      pricingModel: 'fixed',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a quote category that supplies a baseRate', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.post('/api/admin/categories', {
      slug: 'x',
      name: 'X',
      pricingModel: 'quote',
      baseRate: 500,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate slug', async () => {
    const { api } = await signInAdmin(t.app, db);
    await api.post('/api/admin/categories', { slug: 'dup', name: 'Dup', pricingModel: 'quote' });
    const res = await api.post('/api/admin/categories', {
      slug: 'dup',
      name: 'Dup 2',
      pricingModel: 'quote',
    });
    expect(res.status).toBe(409);
  });

  it('lists categories, including inactive ones (unlike the public catalogue)', async () => {
    const { api } = await signInAdmin(t.app, db);
    await api.post('/api/admin/categories', { slug: 'a', name: 'A', pricingModel: 'quote' });
    const [first] = itemsOf<{ id: string }>(await api.get('/api/admin/categories'));
    await api.patch(`/api/admin/categories/${first?.id}`, { isActive: false });

    const res = await api.get('/api/admin/categories');
    expect(res.status).toBe(200);
    expect(itemsOf<{ isActive: boolean }>(res).some((c) => !c.isActive)).toBe(true);
  });

  it('activates/deactivates and edits pricing, recording an audit log entry each time', async () => {
    const { admin, api } = await signInAdmin(t.app, db);
    const created = await api.post('/api/admin/categories', {
      slug: 'edit-me',
      name: 'Edit Me',
      pricingModel: 'quote',
    });
    const { id } = bodyOf<{ id: string }>(created);

    const deactivated = await api.patch(`/api/admin/categories/${id}`, { isActive: false });
    expect(deactivated.status).toBe(200);
    expect(bodyOf<{ isActive: boolean }>(deactivated).isActive).toBe(false);

    const repriced = await api.patch(`/api/admin/categories/${id}`, {
      pricingModel: 'fixed',
      baseRate: 2500,
    });
    expect(repriced.status).toBe(200);
    expect(repriced.body).toMatchObject({ pricingModel: 'fixed', baseRate: '2500.00' });

    const entries = await db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, id));
    expect(entries.filter((e) => e.action === 'category_updated')).toHaveLength(2);
    expect(entries.every((e) => e.adminUserId === admin.id)).toBe(true);
  });

  it('404s updating a category that does not exist', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.patch('/api/admin/categories/00000000-0000-4000-8000-000000000000', {
      isActive: false,
    });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid slug format', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.post('/api/admin/categories', {
      slug: 'Not A Valid Slug!',
      name: 'X',
      pricingModel: 'quote',
    });
    expect(res.status).toBe(400);
  });
});
