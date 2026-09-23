import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider } from '../helpers/factories.js';
import { signInUser, type Api } from '../helpers/providers.js';
import { bookingOf, errorOf, firstQuote, providerOf } from '../helpers/bookings.js';

const handle = createTestDatabase();
const { db } = handle;

let t: TestApp;
let catalogue: Catalogue;
let customer: Api;

beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
  ({ api: customer } = await signInUser(t.app, t.sms));
});
afterAll(() => handle.close());

/** A signed-in, fully eligible provider for `category`. */
async function eligibleProvider(category: { id: string } = catalogue.cleaning) {
  const { user, profile } = await createApprovedProvider(db, category, catalogue.colombo);
  const { api } = await signInUser(t.app, t.sms, user.phoneE164);
  return { api, profileId: profile.id };
}

async function createOnDemandBooking(categorySlug = 'cleaning') {
  const res = await customer.post('/api/bookings', {
    categorySlug,
    citySlug: 'colombo',
    bookingType: 'on_demand',
    serviceAddress: '12 Galle Road',
  });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

describe('the fixed/hourly path: direct acceptance', () => {
  it('walks the full lifecycle to completion', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);

    const accepted = await provider.api.post(`/api/bookings/${booking.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({
      status: 'accepted',
      provider: { id: provider.profileId },
    });
    expect(bookingOf(accepted).timestamps.acceptedAt).toBeTypeOf('string');

    const enRoute = await provider.api.post(`/api/bookings/${booking.id}/en-route`);
    expect(enRoute.status).toBe(200);
    expect(bookingOf(enRoute).status).toBe('en_route');
    expect(bookingOf(enRoute).timestamps.enRouteAt).toBeTypeOf('string');

    const arrived = await provider.api.post(`/api/bookings/${booking.id}/arrived`);
    expect(arrived.status).toBe(200);
    expect(bookingOf(arrived).status).toBe('arrived');

    const started = await provider.api.post(`/api/bookings/${booking.id}/start`);
    expect(started.status).toBe(200);
    expect(bookingOf(started).status).toBe('in_progress');
    expect(bookingOf(started).timestamps.workStartedAt).toBeTypeOf('string');

    const completed = await provider.api.post(`/api/bookings/${booking.id}/complete`);
    expect(completed.status).toBe(200);
    expect(bookingOf(completed).status).toBe('completed');
    expect(bookingOf(completed).timestamps.completedAt).toBeTypeOf('string');

    // The customer sees the same final state.
    const seenByCustomer = await customer.get(`/api/bookings/${booking.id}`);
    expect(bookingOf(seenByCustomer).status).toBe('completed');
  });

  it('rejects skipping a stage', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);

    // Not yet assigned to anyone: this looks like "not found", not "wrong state".
    const skipped = await provider.api.post(`/api/bookings/${booking.id}/arrived`);
    expect(skipped.status).toBe(404);

    // Assigned, but still `accepted`: skipping en-route is a real state violation.
    await provider.api.post(`/api/bookings/${booking.id}/accept`);
    const skipEnRoute = await provider.api.post(`/api/bookings/${booking.id}/start`);
    expect(skipEnRoute.status).toBe(409);
    expect(errorOf(skipEnRoute).code).toBe('INVALID_STATE');
  });

  it('rejects completing twice', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    for (const step of ['accept', 'en-route', 'arrived', 'start', 'complete']) {
      await provider.api.post(`/api/bookings/${booking.id}/${step}`);
    }

    const again = await provider.api.post(`/api/bookings/${booking.id}/complete`);
    expect(again.status).toBe(409);
  });

  it('a second provider cannot also accept an already-accepted booking', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const first = await eligibleProvider(catalogue.cleaning);
    const second = await eligibleProvider(catalogue.cleaning);

    const firstAccept = await first.api.post(`/api/bookings/${booking.id}/accept`);
    expect(firstAccept.status).toBe(200);

    const secondAccept = await second.api.post(`/api/bookings/${booking.id}/accept`);
    expect(secondAccept.status).toBe(409);
    expect(errorOf(secondAccept).code).toBe('INVALID_STATE');

    // The booking is still assigned to the first provider.
    const check = await customer.get(`/api/bookings/${booking.id}`);
    expect(providerOf(check).id).toBe(first.profileId);
  });

  it('only the assigned provider can progress the booking', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const assigned = await eligibleProvider(catalogue.cleaning);
    const bystander = await eligibleProvider(catalogue.cleaning);
    await assigned.api.post(`/api/bookings/${booking.id}/accept`);

    // Indistinguishable from a booking that does not exist for them.
    const res = await bystander.api.post(`/api/bookings/${booking.id}/en-route`);
    expect(res.status).toBe(404);
  });

  it('a quote-priced service cannot be accepted directly', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const provider = await eligibleProvider(catalogue.plumbing);

    const res = await provider.api.post(`/api/bookings/${booking.id}/accept`);
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('QUOTE_NOT_APPLICABLE');
  });

  it('a provider not approved for the category cannot accept it', async () => {
    const booking = await createOnDemandBooking('cleaning');
    // Approved for plumbing, not cleaning.
    const { api } = await eligibleProvider(catalogue.plumbing);

    const res = await api.post(`/api/bookings/${booking.id}/accept`);
    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('PROVIDER_NOT_ELIGIBLE');
  });

  it('a provider with no provider profile cannot accept', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const { api } = await signInUser(t.app, t.sms);

    const res = await api.post(`/api/bookings/${booking.id}/accept`);
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('PROVIDER_PROFILE_REQUIRED');
  });
});

describe('the quote-priced path', () => {
  async function acceptedViaQuote(
    categorySlug = 'plumbing',
    category = catalogue.plumbing,
    amount = '3500.00',
  ) {
    const booking = await createOnDemandBooking(categorySlug);
    const provider = await eligibleProvider(category);
    const quoted = await provider.api.post(`/api/bookings/${booking.id}/quotes`, {
      amount: Number(amount),
    });
    const quoteId = firstQuote(quoted).id;
    const accepted = await customer.post(`/api/bookings/${booking.id}/quotes/${quoteId}/accept`);
    return { booking, provider, quoteId, accepted };
  }

  it('assigns the provider and price once the customer accepts a quote', async () => {
    const { booking, provider, accepted } = await acceptedViaQuote();

    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({
      status: 'accepted',
      agreedAmount: '3500.00',
      provider: { id: provider.profileId },
    });

    const fetched = await customer.get(`/api/bookings/${booking.id}`);
    expect(bookingOf(fetched).agreedAmount).toBe('3500.00');
  });

  it('continues through the same lifecycle as a direct acceptance', async () => {
    const { booking, provider } = await acceptedViaQuote();

    for (const [step, status] of [
      ['en-route', 'en_route'],
      ['arrived', 'arrived'],
      ['start', 'in_progress'],
      ['complete', 'completed'],
    ] as const) {
      const res = await provider.api.post(`/api/bookings/${booking.id}/${step}`);
      expect(res.status).toBe(200);
      expect(bookingOf(res).status).toBe(status);
    }
  });

  it('rejects every other pending quote once one is accepted', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const winner = await eligibleProvider(catalogue.plumbing);
    const loser = await eligibleProvider(catalogue.plumbing);
    const winnerQuote = await winner.api.post(`/api/bookings/${booking.id}/quotes`, {
      amount: 3000,
    });
    const loserQuote = await loser.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 3200 });

    await customer.post(`/api/bookings/${booking.id}/quotes/${firstQuote(winnerQuote).id}/accept`);

    const loserView = await loser.api.get(`/api/bookings/${booking.id}`);
    expect(firstQuote(loserView).status).toBe('rejected');
    expect(loserQuote.status).toBe(201); // sanity: the quote itself was accepted at submission time
  });

  it('a fixed/hourly service cannot receive a quote', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);

    const res = await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('QUOTE_NOT_APPLICABLE');
  });

  it('an ineligible provider cannot submit a quote', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const { api } = await eligibleProvider(catalogue.electrical);

    const res = await api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('PROVIDER_NOT_ELIGIBLE');
  });

  it('a provider cannot have two active quotes on the same booking', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const provider = await eligibleProvider(catalogue.plumbing);
    await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });

    const again = await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 150 });
    expect(again.status).toBe(409);
    expect(errorOf(again).code).toBe('ALREADY_QUOTED');
  });

  it('a provider may quote again after their quote was rejected', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const provider = await eligibleProvider(catalogue.plumbing);
    const first = await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    await customer.post(`/api/bookings/${booking.id}/quotes/${firstQuote(first).id}/reject`);

    const second = await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 90 });
    expect(second.status).toBe(201);
    expect(firstQuote(second).status).toBe('pending');
  });

  it('rejecting a quote leaves the booking open and does not affect other quotes', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const a = await eligibleProvider(catalogue.plumbing);
    const b = await eligibleProvider(catalogue.plumbing);
    const quoteA = await a.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    await b.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 120 });

    const rejected = await customer.post(
      `/api/bookings/${booking.id}/quotes/${firstQuote(quoteA).id}/reject`,
    );
    expect(rejected.status).toBe(200);
    expect(bookingOf(rejected).status).toBe('searching');

    const bView = await b.api.get(`/api/bookings/${booking.id}`);
    expect(firstQuote(bView).status).toBe('pending');
  });

  it('cannot accept or reject a quote once the booking is no longer open', async () => {
    const { booking } = await acceptedViaQuote();
    const other = await eligibleProvider(catalogue.plumbing);
    const lateQuote = await other.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 10 });
    // Quoting on an already-accepted booking is itself refused...
    expect(lateQuote.status).toBe(409);
  });

  it('an eligible provider can view an open booking before quoting on it', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const provider = await eligibleProvider(catalogue.plumbing);

    const res = await provider.api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(200);
    expect(bookingOf(res).status).toBe('searching');
    expect(bookingOf(res).quotes).toEqual([]);
  });

  it('a provider not eligible for the category cannot view the open booking', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const { api } = await eligibleProvider(catalogue.electrical);

    const res = await api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(404);
  });

  it('a provider keeps visibility after their quote is rejected', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const provider = await eligibleProvider(catalogue.plumbing);
    const quoted = await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    await customer.post(`/api/bookings/${booking.id}/quotes/${firstQuote(quoted).id}/reject`);

    const res = await provider.api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(200);
    expect(firstQuote(res).status).toBe('rejected');
  });

  it("a provider only ever sees their own quote, never a competitor's", async () => {
    const booking = await createOnDemandBooking('plumbing');
    const a = await eligibleProvider(catalogue.plumbing);
    const b = await eligibleProvider(catalogue.plumbing);
    await a.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    await b.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 200 });

    const aView = await a.api.get(`/api/bookings/${booking.id}`);
    expect(bookingOf(aView).quotes).toHaveLength(1);
    expect(firstQuote(aView).amount).toBe('100.00');

    const bView = await b.api.get(`/api/bookings/${booking.id}`);
    expect(bookingOf(bView).quotes).toHaveLength(1);
    expect(firstQuote(bView).amount).toBe('200.00');
  });

  it('the customer sees every quote', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const a = await eligibleProvider(catalogue.plumbing);
    const b = await eligibleProvider(catalogue.plumbing);
    await a.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    await b.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 200 });

    const view = await customer.get(`/api/bookings/${booking.id}`);
    expect(bookingOf(view).quotes).toHaveLength(2);
  });

  it('rejects an amount with more than two decimal places', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const provider = await eligibleProvider(catalogue.plumbing);

    const res = await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100.999 });
    expect(res.status).toBe(400);
  });

  it('rejects a zero or negative amount', async () => {
    const booking = await createOnDemandBooking('plumbing');
    const provider = await eligibleProvider(catalogue.plumbing);

    expect(
      (await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 0 })).status,
    ).toBe(400);
    expect(
      (await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: -5 })).status,
    ).toBe(400);
  });
});

describe('provider release (prepares Sprint 6 re-dispatch)', () => {
  it('returns the booking to searching, unassigned', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    await provider.api.post(`/api/bookings/${booking.id}/accept`);

    const released = await provider.api.post(`/api/bookings/${booking.id}/release`, {
      reason: 'Vehicle broke down.',
    });

    expect(released.status).toBe(200);
    expect(bookingOf(released).status).toBe('searching');
    expect(bookingOf(released).provider).toBeNull();
    expect(bookingOf(released).timestamps.acceptedAt).toBeNull();
  });

  it('is not a cancellation: cancellation fields stay empty', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    await provider.api.post(`/api/bookings/${booking.id}/accept`);

    const released = await provider.api.post(`/api/bookings/${booking.id}/release`, {
      reason: 'Running late for another job.',
    });

    expect(bookingOf(released).cancellation).toBeNull();
  });

  it('lets a different eligible provider accept the released booking', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const first = await eligibleProvider(catalogue.cleaning);
    const second = await eligibleProvider(catalogue.cleaning);
    await first.api.post(`/api/bookings/${booking.id}/accept`);
    await first.api.post(`/api/bookings/${booking.id}/release`, { reason: 'Cannot make it.' });

    const res = await second.api.post(`/api/bookings/${booking.id}/accept`);
    expect(res.status).toBe(200);
    expect(providerOf(res).id).toBe(second.profileId);
  });

  it('the original provider can no longer progress it after releasing', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const first = await eligibleProvider(catalogue.cleaning);
    await first.api.post(`/api/bookings/${booking.id}/accept`);
    await first.api.post(`/api/bookings/${booking.id}/release`, { reason: 'x' });

    const res = await first.api.post(`/api/bookings/${booking.id}/en-route`);
    expect(res.status).toBe(404);
  });

  it('requires a reason', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    await provider.api.post(`/api/bookings/${booking.id}/accept`);

    const res = await provider.api.post(`/api/bookings/${booking.id}/release`, { reason: '' });
    expect(res.status).toBe(400);
  });

  it('cannot be released from searching (nothing to release)', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);

    const res = await provider.api.post(`/api/bookings/${booking.id}/release`, { reason: 'x' });
    expect(res.status).toBe(404); // not assigned to this provider
  });

  it('cannot be released once work has started', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    for (const step of ['accept', 'en-route', 'arrived', 'start']) {
      await provider.api.post(`/api/bookings/${booking.id}/${step}`);
    }

    const res = await provider.api.post(`/api/bookings/${booking.id}/release`, { reason: 'x' });
    expect(res.status).toBe(409);
  });

  it('only the assigned provider can release it', async () => {
    const booking = await createOnDemandBooking('cleaning');
    const assigned = await eligibleProvider(catalogue.cleaning);
    const bystander = await eligibleProvider(catalogue.cleaning);
    await assigned.api.post(`/api/bookings/${booking.id}/accept`);

    const res = await bystander.api.post(`/api/bookings/${booking.id}/release`, { reason: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('deep-linking to a missing booking', () => {
  it('is a 404 for both a customer action and a provider action', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const provider = await eligibleProvider(catalogue.cleaning);

    expect((await customer.get(`/api/bookings/${missing}`)).status).toBe(404);
    expect((await provider.api.post(`/api/bookings/${missing}/accept`)).status).toBe(404);
  });
});
