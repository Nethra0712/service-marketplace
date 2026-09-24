import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { payments, providerPayouts, type Payment } from '../../src/db/schema/index.js';
import { AppError } from '../../src/lib/errors.js';
import { MockPaymentProvider } from '../../src/modules/payments/mock-payment-provider.js';
import { createPaymentsService } from '../../src/modules/payments/payments.service.js';
import { FakeClock, buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { mustExist } from '../helpers/bookings.js';
import { completedBooking, type CompletedBooking } from '../helpers/payments.js';

/**
 * Refunds and payouts have no HTTP route: there is no admin-auth concept in
 * this codebase yet (see `providers/review.service.ts` for the identical
 * situation). These tests are what guarantees the rules before an admin app
 * exists — see `payments.service.ts`'s own doc comment.
 *
 * Period bounds throughout are computed from payments' own (real) recorded
 * `succeededAt` values, never from wall-clock `Date.now()`: `completedBooking`
 * drives its app through `t`'s `FakeClock`, which starts near real time but
 * is advanced deliberately (10 minutes per booking), so a payment's
 * `succeededAt` can already be well past a `Date.now()`-based window by the
 * time a test gets around to checking it.
 */
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

function setup() {
  const clock = new FakeClock();
  const mockProvider = new MockPaymentProvider();
  const service = createPaymentsService({
    db,
    clock: clock.now,
    provider: mockProvider,
    commissionBasisPoints: 1500,
    publicApiBaseUrl: 'http://localhost:3000',
  });
  return { clock, mockProvider, service };
}

async function expectRejection(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ status, code });
}

/** Drives a booking to a `succeeded` payment over HTTP, via the app's own (mock) webhook route. */
async function succeededPayment(app: TestApp['app'], booking: CompletedBooking): Promise<Payment> {
  const checkout = await booking.customer.post(
    `/api/bookings/${booking.bookingId}/payment/checkout`,
  );
  const externalReference = (checkout.body as { fields: { orderId: string } }).fields.orderId;
  const fields = {
    orderId: externalReference,
    providerPaymentId: 'gateway-ref-1',
    status: 'succeeded' as const,
    amount: '250.00',
    currency: 'LKR',
  };
  const res = await request(app)
    .post('/api/payments/webhook')
    .send({ ...fields, signature: MockPaymentProvider.sign(fields) });
  expect(res.status).toBe(200);
  const [row] = await db.select().from(payments).where(eq(payments.bookingId, booking.bookingId));
  if (!row) throw new Error('expected a succeeded payment row');
  return row;
}

/** A `[start, end)` window guaranteed to contain every given payment's `succeededAt`. */
function periodAround(...paymentsToInclude: Payment[]): [Date, Date] {
  const times = paymentsToInclude.map((p) => {
    if (!p.succeededAt) throw new Error('expected succeededAt to be set');
    return p.succeededAt.getTime();
  });
  return [new Date(Math.min(...times) - 1000), new Date(Math.max(...times) + 1000)];
}

describe('refundPayment', () => {
  it('refunds a succeeded payment, calling the gateway and recording the refund', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service, mockProvider } = setup();

    const refunded = await service.refundPayment(payment.id, 'Customer complained, not satisfied');
    expect(refunded.status).toBe('refunded');
    expect(mockProvider.refunds).toHaveLength(1);
    expect(mockProvider.refunds[0]).toMatchObject({
      providerPaymentId: 'gateway-ref-1',
      amount: '250.00',
      reason: 'Customer complained, not satisfied',
    });

    const [row] = await db.select().from(payments).where(eq(payments.id, payment.id));
    expect(row?.status).toBe('refunded');
    expect(row?.refundedAt).not.toBeNull();
    // Auditability: when it originally succeeded is never erased by refunding it.
    expect(row?.succeededAt).toEqual(payment.succeededAt);
  });

  it('refuses to refund a payment that never succeeded (still pending)', async () => {
    const booking = await completedBooking(t, db, catalogue);
    await booking.customer.post(`/api/bookings/${booking.bookingId}/payment/checkout`);
    const [pending] = await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, booking.bookingId));
    const { service } = setup();

    await expectRejection(
      service.refundPayment(mustExist(pending, 'pending payment').id, 'x'),
      409,
      'PAYMENT_ALREADY_FINAL',
    );
  });

  it('refuses to refund a payment that was already refunded', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service } = setup();
    await service.refundPayment(payment.id, 'first refund');

    await expectRejection(
      service.refundPayment(payment.id, 'second refund'),
      409,
      'PAYMENT_ALREADY_FINAL',
    );
  });

  it('404s for a payment that does not exist', async () => {
    const { service } = setup();
    await expectRejection(
      service.refundPayment('00000000-0000-4000-8000-000000000000', 'x'),
      404,
      'NOT_FOUND',
    );
  });

  it('refuses to refund a payment already swept into a payout', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service } = setup();

    await service.calculatePayoutsForPeriod(...periodAround(payment));

    await expectRejection(
      service.refundPayment(payment.id, 'too late'),
      409,
      'PAYMENT_ALREADY_FINAL',
    );
  });
});

describe('calculatePayoutsForPeriod (the weekly provider payout ledger)', () => {
  it("computes a provider's payable amount from their succeeded payments in the period", async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service } = setup();

    const payouts = await service.calculatePayoutsForPeriod(...periodAround(payment));

    expect(payouts).toHaveLength(1);
    expect(payouts[0]).toMatchObject({
      providerProfileId: booking.providerProfileId,
      totalServiceAmount: '250.00',
      totalCommissionAmount: '37.50',
      totalProviderEarningAmount: '212.50',
      paymentCount: 1,
      status: 'pending',
    });
  });

  it('sums multiple succeeded payments for the same provider in the period', async () => {
    const first = await completedBooking(t, db, catalogue);
    const firstPayment = await succeededPayment(t.app, first);
    // A second, separately-booked-and-completed job for the SAME provider.
    const second = await completedBooking(t, db, catalogue, {
      phone: first.providerPhone,
      profileId: first.providerProfileId,
    });
    const secondPayment = await succeededPayment(t.app, second);
    const { service } = setup();

    const payouts = await service.calculatePayoutsForPeriod(
      ...periodAround(firstPayment, secondPayment),
    );

    expect(payouts).toHaveLength(1);
    expect(payouts[0]).toMatchObject({
      providerProfileId: first.providerProfileId,
      totalServiceAmount: '500.00', // 250.00 + 250.00
      totalCommissionAmount: '75.00',
      totalProviderEarningAmount: '425.00',
      paymentCount: 2,
    });
  });

  it('gives two different providers two separate payouts for the same period', async () => {
    const a = await completedBooking(t, db, catalogue);
    const paymentA = await succeededPayment(t.app, a);
    const b = await completedBooking(t, db, catalogue); // a fresh, different provider
    const paymentB = await succeededPayment(t.app, b);
    const { service } = setup();

    const payouts = await service.calculatePayoutsForPeriod(...periodAround(paymentA, paymentB));

    expect(payouts).toHaveLength(2);
    expect(payouts.every((p) => p.paymentCount === 1)).toBe(true);
    expect(new Set(payouts.map((p) => p.providerProfileId)).size).toBe(2);
  });

  it('excludes payments outside the period', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service } = setup();

    const succeededAtMs = mustExist(payment.succeededAt, 'succeededAt').getTime();
    const payouts = await service.calculatePayoutsForPeriod(
      new Date(succeededAtMs - 1_000_000),
      new Date(succeededAtMs - 500_000),
    );

    expect(payouts).toHaveLength(0);
  });

  it('excludes payments that are not succeeded (pending, failed)', async () => {
    const booking = await completedBooking(t, db, catalogue);
    await booking.customer.post(`/api/bookings/${booking.bookingId}/payment/checkout`); // stays pending
    const { service } = setup();

    const now = t.clock.now();
    const payouts = await service.calculatePayoutsForPeriod(
      new Date(now.getTime() - 60_000),
      new Date(now.getTime() + 60_000),
    );
    expect(payouts).toHaveLength(0);
  });

  it('is idempotent: recomputing the same period for the same provider does not duplicate or change the payout', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service } = setup();

    const period = periodAround(payment);
    const first = await service.calculatePayoutsForPeriod(...period);
    const second = await service.calculatePayoutsForPeriod(...period);

    expect(second[0]?.id).toBe(first[0]?.id);
    const rows = await db
      .select()
      .from(providerPayouts)
      .where(
        eq(
          providerPayouts.providerProfileId,
          mustExist(first[0], 'first payout').providerProfileId,
        ),
      );
    expect(rows).toHaveLength(1); // never a second payout row for the same provider/period
  });

  it('assigns each included payment to its payout (payoutId set)', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service } = setup();

    const [payout] = await service.calculatePayoutsForPeriod(...periodAround(payment));

    const [row] = await db.select().from(payments).where(eq(payments.id, payment.id));
    expect(row?.payoutId).toBe(mustExist(payout, 'payout').id);
  });

  it('a payment already assigned to a payout is never counted again in a later period calculation', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service } = setup();

    await service.calculatePayoutsForPeriod(...periodAround(payment));

    // A much wider "recompute everything" period must not double-count it.
    const succeededAtMs = mustExist(payment.succeededAt, 'succeededAt').getTime();
    const widePayouts = await service.calculatePayoutsForPeriod(
      new Date(succeededAtMs - 10_000_000),
      new Date(succeededAtMs + 10_000_000),
    );
    expect(widePayouts).toHaveLength(0);
  });
});

describe('markPayoutPaid', () => {
  it('marks a pending payout paid, recording when and an optional note', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service } = setup();
    const [payout] = await service.calculatePayoutsForPeriod(...periodAround(payment));

    const paid = await service.markPayoutPaid(
      mustExist(payout, 'payout').id,
      'Bank transfer ref #12345',
    );
    expect(paid.status).toBe('paid');
    expect(paid.paidAt).toBeTypeOf('string');
  });

  it('refuses to mark an already-paid payout paid again', async () => {
    const booking = await completedBooking(t, db, catalogue);
    const payment = await succeededPayment(t.app, booking);
    const { service } = setup();
    const [payout] = await service.calculatePayoutsForPeriod(...periodAround(payment));
    await service.markPayoutPaid(mustExist(payout, 'payout').id, null);

    await expectRejection(
      service.markPayoutPaid(mustExist(payout, 'payout').id, null),
      409,
      'PAYMENT_ALREADY_FINAL',
    );
  });

  it('404s for a payout that does not exist', async () => {
    const { service } = setup();
    await expectRejection(
      service.markPayoutPaid('00000000-0000-4000-8000-000000000000', null),
      404,
      'NOT_FOUND',
    );
  });
});
