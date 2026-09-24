import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { providerProfiles } from '../../src/db/schema/index.js';
import { createLogger } from '../../src/lib/logger.js';
import { MockPushProvider } from '../../src/modules/notifications/mock-push-provider.js';
import { createNotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { MockPaymentProvider } from '../../src/modules/payments/mock-payment-provider.js';
import { createPaymentsService } from '../../src/modules/payments/payments.service.js';
import { FakeClock } from '../helpers/app.js';
import { mustExist } from '../helpers/bookings.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import {
  createApprovedProvider,
  createBooking,
  createCity,
  createOfferedCategory,
  createUser,
} from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;
afterAll(() => handle.close());

beforeEach(() => resetDatabase(db));

/** Payments wired to a real notifications service, the same way `app.ts` wires them. */
function setup() {
  const clock = new FakeClock();
  const push = new MockPushProvider();
  const notifications = createNotificationsService({
    db,
    clock: clock.now,
    provider: push,
    logger: createLogger({ logLevel: 'silent' }),
  });
  const payments = createPaymentsService({
    db,
    clock: clock.now,
    provider: new MockPaymentProvider(),
    commissionBasisPoints: 1500,
    publicApiBaseUrl: 'http://localhost:3000',
    onPaymentEvent: (event) => notifications.notify(event),
    findProviderUserId: async (providerProfileId) => {
      const [row] = await db
        .select({ userId: providerProfiles.userId })
        .from(providerProfiles)
        .where(eq(providerProfiles.id, providerProfileId));
      return row?.userId;
    },
  });
  return { push, notifications, payments };
}

/** A booking already `completed`, with every stage timestamp its check constraints require. */
async function completedBookingRow() {
  const city = await createCity(db);
  const category = await createOfferedCategory(db, city, {
    slug: 'cleaning',
    pricingModel: 'fixed',
    baseRate: '250.00',
  });
  const customer = await createUser(db);
  const { profile } = await createApprovedProvider(db, category, city);
  const now = new Date();
  const booking = await createBooking(db, customer, category, city, {
    providerProfileId: profile.id,
    status: 'completed',
    agreedAmount: '250.00',
    acceptedAt: now,
    enRouteAt: now,
    arrivedAt: now,
    workStartedAt: now,
    completedAt: now,
  });
  return { booking, customer, providerProfileId: profile.id };
}

describe('a payment outcome notifies the customer who paid', () => {
  it('succeeded', async () => {
    const { notifications, payments } = setup();
    const { booking, customer } = await completedBookingRow();

    const session = await payments.createCheckoutSession(customer.id, booking.id);
    const { orderId, amount, currency } = session.fields as {
      orderId: string;
      amount: string;
      currency: string;
    };
    const callbackFields = {
      orderId,
      providerPaymentId: 'gw-1',
      status: 'succeeded' as const,
      amount,
      currency,
    };
    await payments.handleCallback({
      ...callbackFields,
      signature: MockPaymentProvider.sign(callbackFields),
    });

    const items = await notifications.listNotifications(customer.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'payment_succeeded', bookingId: booking.id });
    expect(items[0]?.body).toContain('250.00');
  });

  it('failed', async () => {
    const { notifications, payments } = setup();
    const { booking, customer } = await completedBookingRow();

    const session = await payments.createCheckoutSession(customer.id, booking.id);
    const { orderId, amount, currency } = session.fields as {
      orderId: string;
      amount: string;
      currency: string;
    };
    const callbackFields = {
      orderId,
      providerPaymentId: 'gw-1',
      status: 'failed' as const,
      amount,
      currency,
    };
    await payments.handleCallback({
      ...callbackFields,
      signature: MockPaymentProvider.sign(callbackFields),
    });

    const items = await notifications.listNotifications(customer.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'payment_failed', bookingId: booking.id });
  });

  it('a duplicate callback does not send a second notification', async () => {
    const { push, notifications, payments } = setup();
    const { booking, customer } = await completedBookingRow();

    const session = await payments.createCheckoutSession(customer.id, booking.id);
    const { orderId, amount, currency } = session.fields as {
      orderId: string;
      amount: string;
      currency: string;
    };
    await notifications.registerToken(customer.id, 'token-1', 'android');
    const callbackFields = {
      orderId,
      providerPaymentId: 'gw-1',
      status: 'succeeded' as const,
      amount,
      currency,
    };
    const signed = { ...callbackFields, signature: MockPaymentProvider.sign(callbackFields) };

    await payments.handleCallback(signed);
    await payments.handleCallback(signed);

    expect(await notifications.listNotifications(customer.id)).toHaveLength(1);
    expect(push.sent).toHaveLength(1);
  });
});

describe('a payout being marked paid notifies the provider', () => {
  it('notifies the provider who earned it, with the payout amount', async () => {
    const { notifications, payments } = setup();
    const { booking, customer, providerProfileId } = await completedBookingRow();

    const session = await payments.createCheckoutSession(customer.id, booking.id);
    const { orderId, amount, currency } = session.fields as {
      orderId: string;
      amount: string;
      currency: string;
    };
    const callbackFields = {
      orderId,
      providerPaymentId: 'gw-1',
      status: 'succeeded' as const,
      amount,
      currency,
    };
    await payments.handleCallback({
      ...callbackFields,
      signature: MockPaymentProvider.sign(callbackFields),
    });

    const periodStart = new Date(0);
    const periodEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    const [payout] = await payments.calculatePayoutsForPeriod(periodStart, periodEnd);
    await payments.markPayoutPaid(mustExist(payout, 'a payout').id, null);

    const [row] = await db
      .select({ userId: providerProfiles.userId })
      .from(providerProfiles)
      .where(eq(providerProfiles.id, providerProfileId));
    const items = await notifications.listNotifications(mustExist(row, 'the provider row').userId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'payout_paid' });
    expect(items[0]?.body).toContain('212.50'); // 250.00 - 15% commission
  });
});
