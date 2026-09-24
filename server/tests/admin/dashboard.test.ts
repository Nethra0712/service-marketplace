import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { MockPaymentProvider } from '../../src/modules/payments/mock-payment-provider.js';
import { bodyOf, signInAdmin } from '../helpers/admin.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createProvider } from '../helpers/factories.js';
import { completedBooking } from '../helpers/payments.js';
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

interface DashboardMetrics {
  users: { total: number };
  providers: { total: number; pendingApplications: number };
  bookings: { total: number; byStatus: Record<string, number>; completed: number };
  revenue: { serviceAmount: string; commissionAmount: string };
}

describe('GET /api/admin/dashboard', () => {
  it('reflects real counts: users, providers, bookings and completed services', async () => {
    await signInUser(t.app, t.sms); // a plain customer
    await completedBooking(t, db, catalogue);

    const { api } = await signInAdmin(t.app, db);
    const res = await api.get('/api/admin/dashboard');
    expect(res.status).toBe(200);

    const metrics = bodyOf<DashboardMetrics>(res);
    expect(metrics.users.total).toBeGreaterThanOrEqual(2); // the plain customer + the booking's own customer
    expect(metrics.providers.total).toBeGreaterThanOrEqual(1);
    expect(metrics.bookings.total).toBeGreaterThanOrEqual(1);
    expect(metrics.bookings.byStatus.completed).toBeGreaterThanOrEqual(1);
    expect(metrics.bookings.completed).toBe(metrics.bookings.byStatus.completed);
  });

  it('sums revenue and commission only from succeeded payments', async () => {
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

    const { api } = await signInAdmin(t.app, db);
    const metrics = bodyOf<DashboardMetrics>(await api.get('/api/admin/dashboard'));
    expect(Number(metrics.revenue.serviceAmount)).toBeGreaterThanOrEqual(
      Number(booking.agreedAmount),
    );
    expect(Number(metrics.revenue.commissionAmount)).toBeGreaterThan(0);
  });

  it('reports pending provider applications', async () => {
    const { api } = await signInAdmin(t.app, db);
    const before = bodyOf<DashboardMetrics>(await api.get('/api/admin/dashboard'));

    const { user } = await createProvider(db);
    const { api: providerApi } = await signInUser(t.app, t.sms, user.phoneE164);
    await providerApi.post('/api/provider/services', {
      categorySlug: 'plumbing',
      citySlug: 'colombo',
    });

    const after = bodyOf<DashboardMetrics>(await api.get('/api/admin/dashboard'));
    expect(after.providers.pendingApplications).toBe(before.providers.pendingApplications + 1);
  });
});
