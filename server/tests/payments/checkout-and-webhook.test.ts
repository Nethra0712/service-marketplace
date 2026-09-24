import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { paymentLedgerEntries, payments } from '../../src/db/schema/index.js';
import { MockPaymentProvider } from '../../src/modules/payments/mock-payment-provider.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { errorOf, mustExist } from '../helpers/bookings.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider } from '../helpers/factories.js';
import {
  checkoutOf,
  completedBooking,
  paymentOf,
  type CompletedBooking,
} from '../helpers/payments.js';
import { signInUser } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;

let t: TestApp;
let catalogue: Catalogue;

beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
});
afterAll(() => handle.close());

/** POSTs directly to the app, with no auth — what the gateway itself would send. */
const webhook = (app: TestApp['app'], body: object) =>
  request(app).post('/api/payments/webhook').send(body);

/** A valid, signed "gateway" callback for a payment created by the mock provider (the app's default in tests). */
function mockCallback(
  payment: { externalReference: string },
  status: 'succeeded' | 'failed' | 'cancelled' | 'pending',
  overrides: Partial<{ providerPaymentId: string; amount: string; currency: string }> = {},
) {
  const fields = {
    orderId: payment.externalReference,
    providerPaymentId: overrides.providerPaymentId ?? 'gateway-ref-1',
    status,
    amount: overrides.amount ?? '250.00',
    currency: overrides.currency ?? 'LKR',
  };
  return { ...fields, signature: MockPaymentProvider.sign(fields) };
}

async function ledgerKindsFor(paymentId: string): Promise<string[]> {
  const rows = await db
    .select({ kind: paymentLedgerEntries.kind })
    .from(paymentLedgerEntries)
    .where(eq(paymentLedgerEntries.paymentId, paymentId));
  return rows.map((r) => r.kind);
}

describe('POST /api/bookings/:id/payment/checkout', () => {
  it('requires authentication', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const res = await request(t.app).post(`/api/bookings/${booking.bookingId}/payment/checkout`);
    expect(res.status).toBe(401);
  });

  it('404s for a booking that does not exist', async () => {
    const { api: customer } = await signInUser(t.app, t.sms);
    const res = await customer.post(
      '/api/bookings/00000000-0000-4000-8000-000000000000/payment/checkout',
    );
    expect(res.status).toBe(404);
  });

  it('404s (looks exactly like missing) for a booking that belongs to a different customer', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const { api: stranger } = await signInUser(t.app, t.sms);
    const res = await stranger.post(`/api/bookings/${booking.bookingId}/payment/checkout`);
    expect(res.status).toBe(404);
  });

  it('refuses to start a checkout before the booking is completed', async () => {
    const { api: customer } = await signInUser(t.app, t.sms);
    const created = await customer.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Rd',
    });
    const bookingId = (created.body as { id: string }).id;

    const res = await customer.post(`/api/bookings/${bookingId}/payment/checkout`);
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('PAYMENT_NOT_READY');
  });

  it('creates a checkout session with the server-computed amount, never a client-supplied one', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const res = await booking.customer.post(
      `/api/bookings/${booking.bookingId}/payment/checkout`,
      // A malicious/buggy client sending its own amount must have zero effect.
      { amount: '1.00', commissionBasisPoints: 0 },
    );

    expect(res.status).toBe(201);
    expect(checkoutOf(res).checkoutUrl).toMatch(/^mock:\/\//);
    expect(checkoutOf(res).fields.amount).toBe('250.00'); // booking.agreedAmount, not the client's "1.00"
  });

  it('resuming checkout for the same booking reuses the same pending payment (same externalReference)', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const first = await booking.customer.post(
      `/api/bookings/${booking.bookingId}/payment/checkout`,
    );
    const second = await booking.customer.post(
      `/api/bookings/${booking.bookingId}/payment/checkout`,
    );

    expect(checkoutOf(first).fields.orderId).toBe(checkoutOf(second).fields.orderId);
    const rows = await db.select().from(payments).where(eq(payments.bookingId, booking.bookingId));
    expect(rows).toHaveLength(1); // no duplicate payment row from calling checkout twice
  });

  it('refuses a new checkout once the booking has already been paid', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const checkout = await booking.customer.post(
      `/api/bookings/${booking.bookingId}/payment/checkout`,
    );
    const externalReference = mustExist(checkoutOf(checkout).fields.orderId, 'checkout orderId');
    await webhook(t.app, mockCallback({ externalReference }, 'succeeded'));

    const res = await booking.customer.post(`/api/bookings/${booking.bookingId}/payment/checkout`);
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('PAYMENT_ALREADY_FINAL');
  });
});

describe('GET /api/bookings/:id/payment', () => {
  it('requires authentication', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const res = await request(t.app).get(`/api/bookings/${booking.bookingId}/payment`);
    expect(res.status).toBe(401);
  });

  it('404s for a booking with no payment yet (not completed)', async () => {
    const { api: customer } = await signInUser(t.app, t.sms);
    const created = await customer.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Rd',
    });
    const res = await customer.get(`/api/bookings/${(created.body as { id: string }).id}/payment`);
    expect(res.status).toBe(404);
  });

  it('shows the customer the correct, server-computed commission breakdown', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const res = await booking.customer.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'pending',
      serviceAmount: '250.00',
      commissionAmount: '37.50', // 15% of 250.00
      providerEarningAmount: '212.50',
      currency: 'LKR',
    });
  });

  it('the assigned provider can also view it', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const res = await booking.providerApi.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ serviceAmount: '250.00' });
  });

  it('an unrelated customer gets 404, not the payment details', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const { api: stranger } = await signInUser(t.app, t.sms);
    const res = await stranger.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(res.status).toBe(404);
  });

  it('an unrelated provider gets 404, not the payment details', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const { user } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);
    const { api: strangerProvider } = await signInUser(t.app, t.sms, user.phoneE164);
    const res = await strangerProvider.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/payments/webhook', () => {
  async function checkedOutBooking(): Promise<
    CompletedBooking & { externalReference: string; paymentId: string }
  > {
    const booking = await completedBooking(t, db, catalogue);
    await booking.customer.post(`/api/bookings/${booking.bookingId}/payment/checkout`);
    const [row] = await db.select().from(payments).where(eq(payments.bookingId, booking.bookingId));
    if (!row) throw new Error('expected a payment row');
    return { ...booking, externalReference: row.externalReference, paymentId: row.id };
  }

  it('marks a payment succeeded on a validly-signed success callback', async () => {
    const booking = await checkedOutBooking();
    const res = await webhook(t.app, mockCallback(booking, 'succeeded'));
    expect(res.status).toBe(200);

    const view = await booking.customer.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(view.body).toMatchObject({ status: 'succeeded', providerPaymentId: 'gateway-ref-1' });
    expect(paymentOf(view).succeededAt).toBeTypeOf('string');
    expect(await ledgerKindsFor(booking.paymentId)).toEqual(['created', 'succeeded']);
  });

  it('marks a payment failed on a validly-signed failure callback', async () => {
    const booking = await checkedOutBooking();
    const res = await webhook(t.app, mockCallback(booking, 'failed'));
    expect(res.status).toBe(200);

    const view = await booking.customer.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(view.body).toMatchObject({ status: 'failed' });
    expect(paymentOf(view).failedAt).toBeTypeOf('string');
    expect(await ledgerKindsFor(booking.paymentId)).toEqual(['created', 'failed']);
  });

  it('marks a payment cancelled on a validly-signed cancellation callback', async () => {
    const booking = await checkedOutBooking();
    await webhook(t.app, mockCallback(booking, 'cancelled'));

    const view = await booking.customer.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(view.body).toMatchObject({ status: 'cancelled' });
  });

  it('after a failure, a fresh checkout starts a new payment attempt (retry)', async () => {
    const booking = await checkedOutBooking();
    await webhook(t.app, mockCallback(booking, 'failed'));

    const retry = await booking.customer.post(
      `/api/bookings/${booking.bookingId}/payment/checkout`,
    );
    expect(retry.status).toBe(201);
    expect(checkoutOf(retry).fields.orderId).not.toBe(booking.externalReference);

    const rows = await db.select().from(payments).where(eq(payments.bookingId, booking.bookingId));
    expect(rows).toHaveLength(2);
  });

  it('a duplicate success callback is idempotent: applied once, ignored (and logged) thereafter', async () => {
    const booking = await checkedOutBooking();
    const callback = mockCallback(booking, 'succeeded');

    const first = await webhook(t.app, callback);
    expect(first.status).toBe(200);
    const afterFirst = await booking.customer.get(`/api/bookings/${booking.bookingId}/payment`);

    const second = await webhook(t.app, callback);
    expect(second.status).toBe(200); // acknowledged, not rejected — but nothing changes
    const afterSecond = await booking.customer.get(`/api/bookings/${booking.bookingId}/payment`);

    expect(paymentOf(afterSecond).succeededAt).toBe(paymentOf(afterFirst).succeededAt);
    expect(paymentOf(afterSecond).status).toBe('succeeded');
    // Exactly one financial transaction was ever recorded, never two.
    expect(await ledgerKindsFor(booking.paymentId)).toEqual([
      'created',
      'succeeded',
      'duplicate_ignored',
    ]);
    const rows = await db.select().from(payments).where(eq(payments.id, booking.paymentId));
    expect(rows).toHaveLength(1);
  });

  it('a duplicate callback after a terminal failure is also idempotent', async () => {
    const booking = await checkedOutBooking();
    const callback = mockCallback(booking, 'failed');
    await webhook(t.app, callback);
    await webhook(t.app, callback);

    expect(await ledgerKindsFor(booking.paymentId)).toEqual([
      'created',
      'failed',
      'duplicate_ignored',
    ]);
  });

  it('rejects a callback with an invalid signature, and leaves the payment untouched', async () => {
    const booking = await checkedOutBooking();
    const forged = { ...mockCallback(booking, 'succeeded'), signature: 'forged' };
    const res = await webhook(t.app, forged);
    expect(res.status).toBe(400);

    const view = await booking.customer.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(paymentOf(view).status).toBe('pending');
  });

  it('rejects a callback for an unknown order id', async () => {
    const res = await webhook(
      t.app,
      mockCallback({ externalReference: 'SM-does-not-exist' }, 'succeeded'),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a callback whose amount does not match the server's own stored amount (never trusts the gateway's amount blindly)", async () => {
    const booking = await checkedOutBooking();
    // Signed correctly FOR the tampered amount (simulates a compromised or
    // buggy gateway report, not just a client edit), still must be rejected
    // because it disagrees with what this server itself computed and stored.
    const tampered = mockCallback(booking, 'succeeded', { amount: '999999.00' });
    const res = await webhook(t.app, tampered);
    expect(res.status).toBe(400);

    const view = await booking.customer.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(paymentOf(view).status).toBe('pending');
  });

  it('rejects a callback missing required fields', async () => {
    const res = await webhook(t.app, { orderId: 'SM-x' });
    expect(res.status).toBe(400);
  });

  it("is reachable without authentication (a gateway cannot present this app's session tokens)", async () => {
    const booking = await checkedOutBooking();
    // `webhook` sends no Authorization header at all — this is the point of the test.
    const res = await webhook(t.app, mockCallback(booking, 'succeeded'));
    expect(res.status).toBe(200);
  });
});

describe('commission is configurable, not hardcoded', () => {
  it('a different PLATFORM_COMMISSION_BASIS_POINTS produces a different split for the same booking amount', async () => {
    const t20 = buildTestApp({ db, config: { platformCommissionBasisPoints: 2000 } });
    const booking = await completedBooking(t20, db, catalogue);
    const res = await booking.customer.get(`/api/bookings/${booking.bookingId}/payment`);
    expect(res.body).toMatchObject({
      serviceAmount: '250.00',
      commissionAmount: '50.00', // 20% of 250.00
      providerEarningAmount: '200.00',
    });
  });
});
