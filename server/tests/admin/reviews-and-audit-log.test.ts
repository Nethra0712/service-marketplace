import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { adminAuditLog } from '../../src/db/schema/index.js';
import { bodyOf, itemsOf, signInAdmin } from '../helpers/admin.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { completedBooking } from '../helpers/payments.js';

const handle = createTestDatabase();
const { db } = handle;
afterAll(() => handle.close());

let t: TestApp;
let catalogue: Catalogue;
beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
});

describe('review moderation', () => {
  it('lists reviews for admin visibility', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const submitted = await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, {
      rating: 5,
    });
    const reviewId = bodyOf<{ id: string }>(submitted).id;
    const { api } = await signInAdmin(t.app, db);

    const res = await api.get('/api/admin/reviews');
    expect(res.status).toBe(200);
    expect(itemsOf<{ id: string }>(res).map((r) => r.id)).toContain(reviewId);
  });

  it('hides a review from the public aggregate without touching its rating or comment, and records an audit log entry', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const submitted = await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, {
      rating: 1,
      comment: 'Abusive text that needs moderating.',
    });
    const reviewId = bodyOf<{ id: string }>(submitted).id;

    const before = await booking.customer.get(
      `/api/reviews/providers/${booking.providerProfileId}/summary`,
    );
    expect(before.body).toEqual({ averageRating: 1, ratingCount: 1 });

    const { admin, api } = await signInAdmin(t.app, db);
    const hideRes = await api.post(`/api/admin/reviews/${reviewId}/hide`, {
      reason: 'Abusive language',
    });
    expect(hideRes.status).toBe(200);
    // Never silently altered.
    const hidden = bodyOf<{ rating: number; comment: string | null }>(hideRes);
    expect(hidden.rating).toBe(1);
    expect(hidden.comment).toBe('Abusive text that needs moderating.');

    const after = await booking.customer.get(
      `/api/reviews/providers/${booking.providerProfileId}/summary`,
    );
    expect(after.body).toEqual({ averageRating: null, ratingCount: 0 });

    const [entry] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.targetId, reviewId));
    expect(entry).toMatchObject({
      adminUserId: admin.id,
      action: 'review_hidden',
      details: { reason: 'Abusive language' },
    });
  });

  it('hiding an already-hidden review is idempotent, not an error', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const submitted = await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, {
      rating: 3,
    });
    const reviewId = bodyOf<{ id: string }>(submitted).id;
    const { api } = await signInAdmin(t.app, db);

    await api.post(`/api/admin/reviews/${reviewId}/hide`, {});
    const second = await api.post(`/api/admin/reviews/${reviewId}/hide`, {});
    expect(second.status).toBe(200);
  });

  it('filters by hidden status', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const submitted = await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, {
      rating: 4,
    });
    const reviewId = bodyOf<{ id: string }>(submitted).id;
    const { api } = await signInAdmin(t.app, db);
    await api.post(`/api/admin/reviews/${reviewId}/hide`, {});

    const hidden = await api.get('/api/admin/reviews?hidden=true');
    expect(itemsOf<{ id: string }>(hidden).map((r) => r.id)).toContain(reviewId);

    const visible = await api.get('/api/admin/reviews?hidden=false');
    expect(itemsOf<{ id: string }>(visible).map((r) => r.id)).not.toContain(reviewId);
  });
});

describe('audit log', () => {
  it('records entries across different admin actions and lists them newest-first', async () => {
    const { api } = await signInAdmin(t.app, db);
    await api.post('/api/admin/categories', { slug: 'audit-a', name: 'A', pricingModel: 'quote' });
    await api.post('/api/admin/categories', { slug: 'audit-b', name: 'B', pricingModel: 'quote' });

    const res = await api.get('/api/admin/audit-log');
    expect(res.status).toBe(200);
    const items = itemsOf<{ createdAt: string }>(res);
    expect(items.length).toBeGreaterThanOrEqual(2);
    const createdAts = items.map((e) => e.createdAt);
    expect([...createdAts].sort().reverse()).toEqual(createdAts);
  });

  it('filters by action', async () => {
    const { api } = await signInAdmin(t.app, db);
    await api.post('/api/admin/categories', { slug: 'audit-c', name: 'C', pricingModel: 'quote' });

    const res = await api.get('/api/admin/audit-log?action=category_created');
    expect(res.status).toBe(200);
    expect(itemsOf<{ action: string }>(res).every((e) => e.action === 'category_created')).toBe(
      true,
    );
  });

  it('has no write endpoint at all — not editable by normal admins', async () => {
    const { api } = await signInAdmin(t.app, db);
    const list = await api.get('/api/admin/audit-log');
    const id = itemsOf<{ id: string }>(list)[0]?.id;

    const postRes = await api.post('/api/admin/audit-log', { action: 'user_suspended' });
    expect([403, 404]).toContain(postRes.status);

    if (id) {
      const patchRes = await api.patch(`/api/admin/audit-log/${id}`, { action: 'user_suspended' });
      expect([403, 404]).toContain(patchRes.status);
      const delRes = await api.del(`/api/admin/audit-log/${id}`);
      expect([403, 404]).toContain(delRes.status);
    }
  });
});
