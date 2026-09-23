import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider } from '../helpers/factories.js';
import { apiFor, signInUser, type Api } from '../helpers/providers.js';
import { bookingOf, errorOf, mustExist, providerOf } from '../helpers/bookings.js';

const handle = createTestDatabase();
const { db } = handle;

let t: TestApp;
let catalogue: Catalogue;
let customer: Api;
let customerId: string;

beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
  const signedIn = await signInUser(t.app, t.sms);
  customer = signedIn.api;
  customerId = signedIn.userId;
});
afterAll(() => handle.close());

async function eligibleProvider(category: { id: string }) {
  const { user, profile } = await createApprovedProvider(db, category, catalogue.colombo);
  const { api } = await signInUser(t.app, t.sms, user.phoneE164);
  return { api, profileId: profile.id };
}

async function createBooking(categorySlug = 'cleaning') {
  const res = await customer.post('/api/bookings', {
    categorySlug,
    citySlug: 'colombo',
    bookingType: 'on_demand',
    serviceAddress: '1 Test Road',
  });
  return res.body as { id: string };
}

describe('customer cancellation', () => {
  it('cancels a searching booking', async () => {
    const booking = await createBooking();

    const res = await customer.post(`/api/bookings/${booking.id}/cancel`, {
      reason: 'Found someone else.',
    });

    expect(res.status).toBe(200);
    expect(bookingOf(res).status).toBe('cancelled');
    const cancellation = mustExist(bookingOf(res).cancellation, 'cancellation');
    expect(cancellation.byUserId).toBe(customerId);
    expect(cancellation.reason).toBe('Found someone else.');
    expect(cancellation.at).toEqual(expect.any(String));
  });

  it.each(['accepted', 'en_route', 'arrived'] as const)('cancels from "%s"', async (stage) => {
    const booking = await createBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    const steps = {
      accepted: ['accept'],
      en_route: ['accept', 'en-route'],
      arrived: ['accept', 'en-route', 'arrived'],
    };
    for (const step of steps[stage]) {
      await provider.api.post(`/api/bookings/${booking.id}/${step}`);
    }

    const res = await customer.post(`/api/bookings/${booking.id}/cancel`, {
      reason: 'Change of plans.',
    });
    expect(res.status).toBe(200);
    expect(bookingOf(res).status).toBe('cancelled');
    // The assignment itself is untouched, only the status changes.
    expect(providerOf(res).id).toBe(provider.profileId);
  });

  it('cannot cancel once work is in progress', async () => {
    const booking = await createBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    for (const step of ['accept', 'en-route', 'arrived', 'start']) {
      await provider.api.post(`/api/bookings/${booking.id}/${step}`);
    }

    const res = await customer.post(`/api/bookings/${booking.id}/cancel`, { reason: 'x' });
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('INVALID_STATE');
  });

  it('cannot cancel a completed booking', async () => {
    const booking = await createBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    for (const step of ['accept', 'en-route', 'arrived', 'start', 'complete']) {
      await provider.api.post(`/api/bookings/${booking.id}/${step}`);
    }

    const res = await customer.post(`/api/bookings/${booking.id}/cancel`, { reason: 'x' });
    expect(res.status).toBe(409);
  });

  it('cannot cancel twice', async () => {
    const booking = await createBooking();
    await customer.post(`/api/bookings/${booking.id}/cancel`, { reason: 'first' });

    const res = await customer.post(`/api/bookings/${booking.id}/cancel`, { reason: 'second' });
    expect(res.status).toBe(409);
  });

  it('requires a reason', async () => {
    const booking = await createBooking();
    const res = await customer.post(`/api/bookings/${booking.id}/cancel`, { reason: '' });
    expect(res.status).toBe(400);
  });

  it('rejects a reason over 500 characters', async () => {
    const booking = await createBooking();
    const res = await customer.post(`/api/bookings/${booking.id}/cancel`, {
      reason: 'x'.repeat(501),
    });
    expect(res.status).toBe(400);
  });

  it('only the owning customer can cancel', async () => {
    const booking = await createBooking();
    const { api: stranger } = await signInUser(t.app, t.sms);

    const res = await stranger.post(`/api/bookings/${booking.id}/cancel`, { reason: 'x' });
    expect(res.status).toBe(404);

    // Untouched: the real customer can still cancel it.
    expect(
      (await customer.post(`/api/bookings/${booking.id}/cancel`, { reason: 'x' })).status,
    ).toBe(200);
  });

  it('a provider cannot cancel a booking (that is not their action)', async () => {
    const booking = await createBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    await provider.api.post(`/api/bookings/${booking.id}/accept`);

    const res = await provider.api.post(`/api/bookings/${booking.id}/cancel`, { reason: 'x' });
    expect(res.status).toBe(404); // no such action from a provider's identity
  });

  it('the assigned provider still sees the booking, and why it was cancelled', async () => {
    const booking = await createBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    await provider.api.post(`/api/bookings/${booking.id}/accept`);
    await customer.post(`/api/bookings/${booking.id}/cancel`, { reason: 'Emergency came up.' });

    const view = await provider.api.get(`/api/bookings/${booking.id}`);
    expect(view.status).toBe(200);
    expect(bookingOf(view).status).toBe('cancelled');
    expect(mustExist(bookingOf(view).cancellation, 'cancellation').reason).toBe(
      'Emergency came up.',
    );
  });

  it('the provider can no longer progress a cancelled booking', async () => {
    const booking = await createBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    await provider.api.post(`/api/bookings/${booking.id}/accept`);
    await customer.post(`/api/bookings/${booking.id}/cancel`, { reason: 'x' });

    const res = await provider.api.post(`/api/bookings/${booking.id}/en-route`);
    expect(res.status).toBe(409);
  });

  it('requires authentication', async () => {
    const booking = await createBooking();
    const res = await apiFor(t.app).post(`/api/bookings/${booking.id}/cancel`, { reason: 'x' });
    expect(res.status).toBe(401);
  });
});
