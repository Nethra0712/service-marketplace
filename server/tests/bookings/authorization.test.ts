import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider } from '../helpers/factories.js';
import { apiFor, signInUser, type Api } from '../helpers/providers.js';
import { bookingOf, firstQuote, itemsOf } from '../helpers/bookings.js';

const handle = createTestDatabase();
const { db } = handle;

let t: TestApp;
let catalogue: Catalogue;
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
});
afterAll(() => handle.close());

async function customer() {
  const { api, userId } = await signInUser(t.app, t.sms);
  return { api, userId };
}

async function eligibleProvider(category: { id: string } = catalogue.cleaning) {
  const { user, profile } = await createApprovedProvider(db, category, catalogue.colombo);
  const { api } = await signInUser(t.app, t.sms, user.phoneE164);
  return { api, profileId: profile.id };
}

async function createBooking(owner: Api, categorySlug = 'cleaning') {
  const res = await owner.post('/api/bookings', {
    categorySlug,
    citySlug: 'colombo',
    bookingType: 'on_demand',
    serviceAddress: '1 Test Road',
  });
  return res.body as { id: string };
}

describe('authentication is required everywhere', () => {
  it.each([
    ['POST', '/api/bookings'],
    ['GET', '/api/bookings/mine'],
    ['GET', '/api/bookings/assigned'],
    ['GET', '/api/bookings/open'],
    [`GET`, `/api/bookings/${MISSING_ID}`],
    ['POST', `/api/bookings/${MISSING_ID}/accept`],
    ['POST', `/api/bookings/${MISSING_ID}/en-route`],
    ['POST', `/api/bookings/${MISSING_ID}/arrived`],
    ['POST', `/api/bookings/${MISSING_ID}/start`],
    ['POST', `/api/bookings/${MISSING_ID}/complete`],
    ['POST', `/api/bookings/${MISSING_ID}/release`],
    ['POST', `/api/bookings/${MISSING_ID}/cancel`],
    ['POST', `/api/bookings/${MISSING_ID}/quotes`],
    ['POST', `/api/bookings/${MISSING_ID}/quotes/${MISSING_ID}/accept`],
    ['POST', `/api/bookings/${MISSING_ID}/quotes/${MISSING_ID}/reject`],
  ] as const)('%s %s is 401 when signed out', async (method, path) => {
    const anonymous = apiFor(t.app);
    const res = method === 'GET' ? await anonymous.get(path) : await anonymous.post(path, {});
    expect(res.status).toBe(401);
  });
});

describe("a customer cannot reach another customer's booking", () => {
  it('GET is a 404, not a 403 (existence is not revealed)', async () => {
    const owner = await customer();
    const stranger = await customer();
    const booking = await createBooking(owner.api);

    const res = await stranger.api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(404);
  });

  it('cannot cancel it', async () => {
    const owner = await customer();
    const stranger = await customer();
    const booking = await createBooking(owner.api);

    const res = await stranger.api.post(`/api/bookings/${booking.id}/cancel`, { reason: 'x' });
    expect(res.status).toBe(404);
  });

  it("does not appear in the stranger's own list", async () => {
    const owner = await customer();
    const stranger = await customer();
    await createBooking(owner.api);

    const res = await stranger.api.get('/api/bookings/mine');
    expect(itemsOf(res)).toEqual([]);
  });

  it('cannot accept or reject a quote on it', async () => {
    const owner = await customer();
    const stranger = await customer();
    const booking = await createBooking(owner.api, 'plumbing');
    const provider = await eligibleProvider(catalogue.plumbing);
    const quoted = await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    const quoteId = firstQuote(quoted).id;

    expect(
      (await stranger.api.post(`/api/bookings/${booking.id}/quotes/${quoteId}/accept`)).status,
    ).toBe(404);
    expect(
      (await stranger.api.post(`/api/bookings/${booking.id}/quotes/${quoteId}/reject`)).status,
    ).toBe(404);

    // Untouched: the real owner still can.
    expect(
      (await owner.api.post(`/api/bookings/${booking.id}/quotes/${quoteId}/accept`)).status,
    ).toBe(200);
  });
});

describe('a provider cannot reach a booking that is not theirs', () => {
  it('cannot complete a booking assigned to another provider', async () => {
    const owner = await customer();
    const booking = await createBooking(owner.api, 'cleaning');
    const assigned = await eligibleProvider(catalogue.cleaning);
    const other = await eligibleProvider(catalogue.cleaning);
    for (const step of ['accept', 'en-route', 'arrived', 'start']) {
      await assigned.api.post(`/api/bookings/${booking.id}/${step}`);
    }

    const res = await other.api.post(`/api/bookings/${booking.id}/complete`);
    expect(res.status).toBe(404);

    // Untouched: still in_progress, not completed by the impostor.
    const check = await owner.api.get(`/api/bookings/${booking.id}`);
    expect(bookingOf(check).status).toBe('in_progress');
  });

  it("does not appear in another provider's assigned list", async () => {
    const owner = await customer();
    const booking = await createBooking(owner.api, 'cleaning');
    const assigned = await eligibleProvider(catalogue.cleaning);
    const other = await eligibleProvider(catalogue.cleaning);
    await assigned.api.post(`/api/bookings/${booking.id}/accept`);

    const res = await other.api.get('/api/bookings/assigned');
    expect(itemsOf(res)).toEqual([]);
  });
});

describe('someone who is both a customer and a provider', () => {
  it('their customer bookings never appear in their own assigned/open lists', async () => {
    const { user } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);
    const { api } = await signInUser(t.app, t.sms, user.phoneE164);

    // The same person also requests a cleaning job for themselves.
    const ownRequest = await createBooking(api, 'cleaning');

    const assigned = await api.get('/api/bookings/assigned');
    expect(itemsOf(assigned)).toEqual([]);

    // It does show up as an open request they could in principle accept...
    const open = await api.get('/api/bookings/open');
    expect(itemsOf(open).map((b: { id: string }) => b.id)).toContain(ownRequest.id);
  });

  it('can accept their own request (nothing stops a provider double-acting as customer here)', async () => {
    // Documents current behaviour: there is no same-person restriction in this
    // sprint. Realistic prevention (e.g. self-dealing) is a later concern.
    const { user } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);
    const { api } = await signInUser(t.app, t.sms, user.phoneE164);
    const booking = await createBooking(api, 'cleaning');

    const res = await api.post(`/api/bookings/${booking.id}/accept`);
    expect(res.status).toBe(200);
  });
});

describe('malformed identifiers', () => {
  it('a non-UUID booking id is a validation error, not a crash', async () => {
    const { api } = await customer();
    const res = await api.get('/api/bookings/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('a well-formed but unknown quote id under a real booking is a 404', async () => {
    const owner = await customer();
    const booking = await createBooking(owner.api, 'plumbing');

    const res = await owner.api.post(`/api/bookings/${booking.id}/quotes/${MISSING_ID}/accept`);
    expect(res.status).toBe(404);
  });
});
