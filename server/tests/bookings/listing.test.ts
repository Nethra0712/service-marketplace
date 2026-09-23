import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../helpers/app.js';
import { addKandy, createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import {
  createApplication,
  createApprovedProvider,
  createProvider,
  only,
} from '../helpers/factories.js';
import { apiFor, signInUser, type Api } from '../helpers/providers.js';
import { errorOf, itemsOf } from '../helpers/bookings.js';

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

async function customer() {
  const { api } = await signInUser(t.app, t.sms);
  return api;
}

async function eligibleProvider(category: { id: string }, city = catalogue.colombo) {
  const { user, profile } = await createApprovedProvider(db, category, city);
  const { api } = await signInUser(t.app, t.sms, user.phoneE164);
  return { api, profileId: profile.id };
}

async function bookingFor(api: Api, categorySlug: string, citySlug = 'colombo') {
  const res = await api.post('/api/bookings', {
    categorySlug,
    citySlug,
    bookingType: 'on_demand',
    serviceAddress: '1 Test Road',
  });
  return res.body as { id: string };
}

describe('GET /api/bookings/mine', () => {
  it("lists only the caller's own bookings", async () => {
    const alice = await customer();
    const bob = await customer();
    const aliceBooking = await bookingFor(alice, 'cleaning');
    await bookingFor(bob, 'cleaning');

    const res = await alice.get('/api/bookings/mine');

    expect(res.status).toBe(200);
    expect(itemsOf(res)).toHaveLength(1);
    expect(only(itemsOf(res)).id).toBe(aliceBooking.id);
  });

  it('is empty for a customer with no bookings', async () => {
    const alice = await customer();
    const res = await alice.get('/api/bookings/mine');
    expect(itemsOf(res)).toEqual([]);
  });

  it('filters by status', async () => {
    const alice = await customer();
    const kept = await bookingFor(alice, 'cleaning');
    const cancelled = await bookingFor(alice, 'plumbing');
    await alice.post(`/api/bookings/${cancelled.id}/cancel`, { reason: 'x' });

    const res = await alice.get('/api/bookings/mine?status=searching');

    expect(itemsOf(res)).toHaveLength(1);
    expect(only(itemsOf(res)).id).toBe(kept.id);
  });

  it('newest first', async () => {
    const alice = await customer();
    const first = await bookingFor(alice, 'cleaning');
    const second = await bookingFor(alice, 'plumbing');

    const res = await alice.get('/api/bookings/mine');

    expect(itemsOf(res).map((b: { id: string }) => b.id)).toEqual([second.id, first.id]);
  });

  it('requires authentication', async () => {
    const res = await apiFor(t.app).get('/api/bookings/mine');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/bookings/assigned', () => {
  it('lists only bookings assigned to the caller', async () => {
    const alice = await customer();
    const a = await eligibleProvider(catalogue.cleaning);
    const b = await eligibleProvider(catalogue.cleaning);
    const bookingA = await bookingFor(alice, 'cleaning');
    const bookingB = await bookingFor(alice, 'cleaning');
    await a.api.post(`/api/bookings/${bookingA.id}/accept`);
    await b.api.post(`/api/bookings/${bookingB.id}/accept`);

    const res = await a.api.get('/api/bookings/assigned');

    expect(itemsOf(res)).toHaveLength(1);
    expect(only(itemsOf(res)).id).toBe(bookingA.id);
  });

  it('does not include open (unassigned) bookings', async () => {
    const alice = await customer();
    await bookingFor(alice, 'cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);

    const res = await provider.api.get('/api/bookings/assigned');
    expect(itemsOf(res)).toEqual([]);
  });

  it('404s for a caller with no provider profile', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.get('/api/bookings/assigned');
    expect(res.status).toBe(404);
    expect(errorOf(res).code).toBe('PROVIDER_PROFILE_NOT_FOUND');
  });
});

describe('GET /api/bookings/open', () => {
  it('lists searching bookings across every category/city the provider is approved for', async () => {
    const alice = await customer();
    const cleaningBooking = await bookingFor(alice, 'cleaning');
    const plumbingBooking = await bookingFor(alice, 'plumbing');
    await bookingFor(alice, 'electrical'); // not approved for this one

    const { user, profile: cleaningProfile } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    await createApplication(
      db,
      cleaningProfile.id,
      catalogue.plumbing,
      catalogue.colombo,
      'approved',
    );
    const { api } = await signInUser(t.app, t.sms, user.phoneE164);

    const res = await api.get('/api/bookings/open');

    const ids = (itemsOf(res) as { id: string }[]).map((b) => b.id).sort();
    expect(ids).toEqual([cleaningBooking.id, plumbingBooking.id].sort());
  });

  it('excludes bookings that are no longer searching', async () => {
    const alice = await customer();
    const booking = await bookingFor(alice, 'cleaning');
    const provider = await eligibleProvider(catalogue.cleaning);
    await provider.api.post(`/api/bookings/${booking.id}/accept`);

    const other = await eligibleProvider(catalogue.cleaning);
    const res = await other.api.get('/api/bookings/open');
    expect(itemsOf(res)).toEqual([]);
  });

  it('is an empty list (not an error) for a provider approved for nothing yet', async () => {
    const alice = await customer();
    await bookingFor(alice, 'cleaning');
    const { user } = await createProvider(db); // has a profile, but no applications at all

    const { api } = await signInUser(t.app, t.sms, user.phoneE164);
    const res = await api.get('/api/bookings/open');

    expect(res.status).toBe(200);
    expect(itemsOf(res)).toEqual([]);
  });

  it('404s for a caller with no provider profile at all', async () => {
    const alice = await customer();
    await bookingFor(alice, 'cleaning');

    const { api } = await signInUser(t.app, t.sms);
    const res = await api.get('/api/bookings/open');
    expect(res.status).toBe(404);
    expect(errorOf(res).code).toBe('PROVIDER_PROFILE_NOT_FOUND');
  });

  it('is scoped by city: approval in one city does not leak requests from another', async () => {
    const kandy = await addKandy(db, catalogue);
    const alice = await customer();
    await bookingFor(alice, 'plumbing', 'colombo');
    const kandyBooking = await bookingFor(alice, 'plumbing', 'kandy');

    const provider = await eligibleProvider(catalogue.plumbing, kandy);
    const res = await provider.api.get('/api/bookings/open');

    expect(itemsOf(res)).toHaveLength(1);
    expect(only(itemsOf(res)).id).toBe(kandyBooking.id);
  });
});
