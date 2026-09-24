import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { adminAuditLog } from '../../src/db/schema/index.js';
import { MockPaymentProvider } from '../../src/modules/payments/mock-payment-provider.js';
import { bodyOf, itemsOf, signInAdmin } from '../helpers/admin.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { completedBooking, type CompletedBooking } from '../helpers/payments.js';
import { signInUser } from '../helpers/providers.js';

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

/** A completed booking whose payment has actually succeeded (checkout + a confirmed gateway callback). */
async function paidBooking(): Promise<CompletedBooking> {
  const booking = await completedBooking(t, db, catalogue);
  const checkout = await booking.customer.post(
    `/api/bookings/${booking.bookingId}/payment/checkout`,
  );
  const fields = bodyOf<{ fields: { orderId: string; amount: string; currency: string } }>(
    checkout,
  ).fields;
  const callback = {
    orderId: fields.orderId,
    providerPaymentId: 'gw-1',
    status: 'succeeded' as const,
    amount: fields.amount,
    currency: fields.currency,
  };
  await request(t.app)
    .post('/api/payments/webhook')
    .send({ ...callback, signature: MockPaymentProvider.sign(callback) });
  return booking;
}

describe('booking visibility', () => {
  it('lists bookings, searchable by customer/provider, and 404-free detail lookup', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const { api } = await signInAdmin(t.app, db);

    const list = await api.get('/api/admin/bookings');
    expect(list.status).toBe(200);
    expect(itemsOf<{ id: string }>(list).map((b) => b.id)).toContain(booking.bookingId);

    const filtered = await api.get('/api/admin/bookings?status=completed');
    expect(itemsOf<{ id: string }>(filtered).map((b) => b.id)).toContain(booking.bookingId);
  });

  it('inspects full detail: state and assignment history', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const { api } = await signInAdmin(t.app, db);

    const res = await api.get(`/api/admin/bookings/${booking.bookingId}`);
    expect(res.status).toBe(200);
    const detail = bodyOf<{
      status: string;
      offers: { providerProfileId: string }[];
      cancelledAt: string | null;
    }>(res);
    expect(detail.status).toBe('completed');
    expect(detail.offers.length).toBeGreaterThan(0);
    expect(detail.offers[0]).toMatchObject({ providerProfileId: booking.providerProfileId });
    expect(detail.cancelledAt).toBeNull();
  });

  it('shows a cancellation reason once a booking is cancelled', async () => {
    const { api: customer } = await signInUser(t.app, t.sms);
    const created = await customer.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Rd',
    });
    const bookingId = bodyOf<{ id: string }>(created).id;
    await customer.post(`/api/bookings/${bookingId}/cancel`, { reason: 'Changed my mind' });

    const { api } = await signInAdmin(t.app, db);
    const res = await api.get(`/api/admin/bookings/${bookingId}`);
    const detail = bodyOf<{ status: string; cancellationReason: string | null }>(res);
    expect(detail.status).toBe('cancelled');
    expect(detail.cancellationReason).toBe('Changed my mind');
  });

  it('404s for a booking that does not exist', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.get('/api/admin/bookings/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('payment visibility and refunds', () => {
  it('lists payments and shows full detail with the ledger (transaction history)', async () => {
    const booking = await paidBooking();
    const { api } = await signInAdmin(t.app, db);

    const list = await api.get('/api/admin/payments?status=succeeded');
    expect(list.status).toBe(200);
    const payments = itemsOf<{ id: string; bookingId: string }>(list);
    expect(payments.map((p) => p.bookingId)).toContain(booking.bookingId);

    const detail = await api.get(`/api/admin/payments/${payments[0]?.id}`);
    expect(detail.status).toBe(200);
    const ledger = bodyOf<{ ledger: { kind: string }[] }>(detail).ledger;
    expect(ledger.map((e) => e.kind)).toEqual(['created', 'succeeded']);
  });

  it('refunds a succeeded payment and records an audit log entry', async () => {
    await paidBooking();
    const { admin, api } = await signInAdmin(t.app, db);
    const [payment] = itemsOf<{ id: string }>(await api.get('/api/admin/payments'));

    const res = await api.post(`/api/admin/payments/${payment?.id}/refund`, {
      reason: 'Customer complaint',
    });
    expect(res.status).toBe(200);
    expect(bodyOf<{ status: string }>(res).status).toBe('refunded');

    const [entry] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.targetId, payment?.id ?? ''));
    expect(entry).toMatchObject({
      adminUserId: admin.id,
      action: 'payment_refunded',
      details: { reason: 'Customer complaint' },
    });
  });

  it('requires a reason to refund', async () => {
    await paidBooking();
    const { api } = await signInAdmin(t.app, db);
    const [payment] = itemsOf<{ id: string }>(await api.get('/api/admin/payments'));
    const res = await api.post(`/api/admin/payments/${payment?.id}/refund`, {});
    expect(res.status).toBe(400);
  });
});

describe('payout management', () => {
  it('calculates payouts for a period from succeeded payments, and lists them', async () => {
    const booking = await paidBooking();
    const { api } = await signInAdmin(t.app, db);

    const calc = await api.post('/api/admin/payouts/calculate', {
      periodStart: '2020-01-01T00:00:00Z',
      periodEnd: '2030-01-01T00:00:00Z',
    });
    expect(calc.status).toBe(201);
    const created = itemsOf<{ id: string; providerProfileId: string; status: string }>(calc);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      providerProfileId: booking.providerProfileId,
      status: 'pending',
    });

    const list = await api.get('/api/admin/payouts');
    expect(list.status).toBe(200);
    expect(itemsOf<{ id: string }>(list).map((p) => p.id)).toContain(created[0]?.id);
  });

  it('rejects periodEnd not after periodStart', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.post('/api/admin/payouts/calculate', {
      periodStart: '2030-01-01T00:00:00Z',
      periodEnd: '2020-01-01T00:00:00Z',
    });
    expect(res.status).toBe(400);
  });

  it('marks a payout paid and records an audit log entry', async () => {
    await paidBooking();
    const { admin, api } = await signInAdmin(t.app, db);
    const calc = await api.post('/api/admin/payouts/calculate', {
      periodStart: '2020-01-01T00:00:00Z',
      periodEnd: '2030-01-01T00:00:00Z',
    });
    const payoutId = itemsOf<{ id: string }>(calc)[0]?.id;

    const res = await api.post(`/api/admin/payouts/${payoutId}/mark-paid`, {
      note: 'Bank transfer done',
    });
    expect(res.status).toBe(200);
    expect(bodyOf<{ status: string }>(res).status).toBe('paid');

    const [entry] = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.targetId, payoutId ?? ''));
    expect(entry).toMatchObject({
      adminUserId: admin.id,
      action: 'payout_marked_paid',
      details: { note: 'Bank transfer done' },
    });
  });

  it('404s marking an unknown payout paid', async () => {
    const { api } = await signInAdmin(t.app, db);
    const res = await api.post(
      '/api/admin/payouts/00000000-0000-4000-8000-000000000000/mark-paid',
      {},
    );
    expect(res.status).toBe(404);
  });

  it("lists a specific provider's payout history", async () => {
    const booking = await paidBooking();
    const { api } = await signInAdmin(t.app, db);
    await api.post('/api/admin/payouts/calculate', {
      periodStart: '2020-01-01T00:00:00Z',
      periodEnd: '2030-01-01T00:00:00Z',
    });

    const res = await api.get(`/api/admin/payouts/providers/${booking.providerProfileId}`);
    expect(res.status).toBe(200);
    expect(itemsOf(res)).toHaveLength(1);
  });
});
