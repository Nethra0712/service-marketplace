import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { providerProfiles } from '../../src/db/schema/index.js';
import {
  MATCHING_WINDOW_MS,
  OFFER_RESPONSE_WINDOW_MS,
} from '../../src/modules/bookings/bookings.service.js';
import { WAVE_SIZE } from '../../src/modules/matching/index.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import {
  createApplication,
  createApprovedProvider,
  createCity,
  createProvider,
  offerCategory,
  setProviderLocation,
} from '../helpers/factories.js';
import { signInUser, type Api } from '../helpers/providers.js';
import { bookingOf, errorOf, mustExist } from '../helpers/bookings.js';

const handle = createTestDatabase();
const { db } = handle;

let t: TestApp;
let catalogue: Catalogue;
let customer: Api;
let customerPhone: string;

beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
  ({ api: customer, phone: customerPhone } = await signInUser(t.app, t.sms));
});
afterAll(() => handle.close());

/** A signed-in, fully eligible (online, approved, verified) provider. */
async function eligibleProvider(
  category: { id: string } = catalogue.cleaning,
  city = catalogue.colombo,
) {
  const { user, profile } = await createApprovedProvider(db, category, city);
  const { api } = await signInUser(t.app, t.sms, user.phoneE164);
  return { api, profileId: profile.id };
}

// A fixed job location, paired with a fixed nearby provider location, so tests that need
// "these N providers rank ahead of that one" get a deterministic order instead of depending
// on random UUID tie-breaks.
const JOB_LOCATION = { latitude: 6.9344, longitude: 79.8428 };
const NEAR_LOCATION = { latitude: 6.9271, longitude: 79.8612 };

/** `n` eligible providers, all pinned near {@link JOB_LOCATION}, so they rank ahead of anyone unlocated. */
async function nearbyProviders(n: number, category = catalogue.cleaning) {
  const providers = [];
  for (let i = 0; i < n; i += 1) {
    const p = await eligibleProvider(category);
    await setProviderLocation(
      db,
      { id: p.profileId },
      NEAR_LOCATION.latitude,
      NEAR_LOCATION.longitude,
    );
    providers.push(p);
  }
  return providers;
}

async function setOffline(profileId: string) {
  await db
    .update(providerProfiles)
    .set({ availability: 'offline' })
    .where(eq(providerProfiles.id, profileId));
}

async function createOnDemandBooking(
  categorySlug = 'cleaning',
  citySlug = 'colombo',
  location?: { latitude: number; longitude: number },
) {
  const res = await customer.post('/api/bookings', {
    categorySlug,
    citySlug,
    bookingType: 'on_demand',
    serviceAddress: '12 Galle Road',
    ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
  });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

const myOfferOf = (res: { body: unknown }) => bookingOf(res).myOffer;

describe('dispatch: eligibility gates', () => {
  it('does not offer a provider approved for a different category', async () => {
    const provider = await eligibleProvider(catalogue.plumbing);
    const booking = await createOnDemandBooking('cleaning');

    const res = await provider.api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(404); // never offered, so cannot even see it
  });

  it('does not offer a provider whose application is only pending', async () => {
    const { user, profile } = await createProvider(db);
    await db
      .update(providerProfiles)
      .set({ verificationStatus: 'verified', submittedAt: new Date(), reviewedAt: new Date() })
      .where(eq(providerProfiles.id, profile.id));
    await createApplication(db, profile.id, catalogue.cleaning, catalogue.colombo, 'pending');
    const { api } = await signInUser(t.app, t.sms, user.phoneE164);
    const booking = await createOnDemandBooking('cleaning');

    const res = await api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(404);
  });

  it('does not offer an unverified provider even with an approved application', async () => {
    const { user, profile } = await createProvider(db); // draft verification
    await createApplication(db, profile.id, catalogue.cleaning, catalogue.colombo, 'approved');
    const { api } = await signInUser(t.app, t.sms, user.phoneE164);
    const booking = await createOnDemandBooking('cleaning');

    const res = await api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(404);
  });

  it('does not offer a provider approved in a different city', async () => {
    const kandy = await createCity(db, { slug: 'kandy', name: 'Kandy' });
    await offerCategory(db, kandy, catalogue.cleaning);
    const provider = await eligibleProvider(catalogue.cleaning, kandy);
    const booking = await createOnDemandBooking('cleaning', 'colombo');

    const res = await provider.api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(404);
  });

  it('does not offer an offline provider', async () => {
    const provider = await eligibleProvider(catalogue.cleaning);
    await setOffline(provider.profileId);
    const booking = await createOnDemandBooking('cleaning');

    const res = await provider.api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(404);
  });

  it('does not offer a provider who already has an active booking', async () => {
    const provider = await eligibleProvider(catalogue.cleaning);
    const busyOn = await createOnDemandBooking('cleaning');
    const accept = await provider.api.post(`/api/bookings/${busyOn.id}/accept`);
    expect(accept.status).toBe(200);

    const secondJob = await createOnDemandBooking('cleaning');
    const res = await provider.api.get(`/api/bookings/${secondJob.id}`);
    expect(res.status).toBe(404); // busy provider was never offered the second job
  });

  it('stays searching, with nobody offered, when no eligible providers exist', async () => {
    const booking = await createOnDemandBooking('cleaning');

    const res = await customer.get(`/api/bookings/${booking.id}`);
    expect(bookingOf(res).status).toBe('searching');
    expect(bookingOf(res).provider).toBeNull();
  });
});

describe('dispatch: ranking', () => {
  // Increasing real-world distance from the job, in Sri Lanka.
  const JOB = { latitude: 6.9344, longitude: 79.8428 }; // Colombo Fort
  const NEAR = { latitude: 6.9271, longitude: 79.8612 }; // ~2km
  const MID = { latitude: 6.9019, longitude: 79.8607 }; // ~4km
  const FAR = { latitude: 7.2906, longitude: 80.6337 }; // Kandy, ~100km
  const FARTHEST = { latitude: 9.6615, longitude: 80.0255 }; // Jaffna, ~300km

  it('fills the wave with the closest candidates and leaves the rest for later', async () => {
    const near = await eligibleProvider(catalogue.cleaning);
    const mid = await eligibleProvider(catalogue.cleaning);
    const far = await eligibleProvider(catalogue.cleaning);
    const farthest = await eligibleProvider(catalogue.cleaning);
    await setProviderLocation(db, { id: near.profileId }, NEAR.latitude, NEAR.longitude);
    await setProviderLocation(db, { id: mid.profileId }, MID.latitude, MID.longitude);
    await setProviderLocation(db, { id: far.profileId }, FAR.latitude, FAR.longitude);
    await setProviderLocation(
      db,
      { id: farthest.profileId },
      FARTHEST.latitude,
      FARTHEST.longitude,
    );
    expect(WAVE_SIZE).toBe(3); // this test's math assumes the documented wave size

    const booking = await createOnDemandBooking('cleaning', 'colombo', JOB);

    expect(myOfferOf(await near.api.get(`/api/bookings/${booking.id}`))?.status).toBe('pending');
    expect(myOfferOf(await mid.api.get(`/api/bookings/${booking.id}`))?.status).toBe('pending');
    expect(myOfferOf(await far.api.get(`/api/bookings/${booking.id}`))?.status).toBe('pending');
    expect((await farthest.api.get(`/api/bookings/${booking.id}`)).status).toBe(404);
  });
});

describe('dispatch: waves', () => {
  it('offers the next wave once every current offer is declined', async () => {
    const wave1 = await nearbyProviders(WAVE_SIZE);
    const waiting = await eligibleProvider(catalogue.cleaning); // unlocated: ranks last

    const booking = await createOnDemandBooking('cleaning', 'colombo', JOB_LOCATION);
    expect((await waiting.api.get(`/api/bookings/${booking.id}`)).status).toBe(404);

    await mustExist(wave1[0], 'wave 1 provider 0').api.post(`/api/bookings/${booking.id}/decline`);
    await mustExist(wave1[1], 'wave 1 provider 1').api.post(`/api/bookings/${booking.id}/decline`);
    // One offer (the third's) is still pending: the next wave must not have started yet.
    expect((await waiting.api.get(`/api/bookings/${booking.id}`)).status).toBe(404);

    await mustExist(wave1[2], 'wave 1 provider 2').api.post(`/api/bookings/${booking.id}/decline`);
    // Wave 1 is now fully resolved (all declined): wave 2 should reach `waiting`.
    const res = await waiting.api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(200);
    expect(myOfferOf(res)).toMatchObject({ status: 'pending', wave: 2 });
  });

  it('offers the next wave once the current wave times out unanswered', async () => {
    await nearbyProviders(WAVE_SIZE);
    const waiting = await eligibleProvider(catalogue.cleaning); // unlocated: ranks last
    const booking = await createOnDemandBooking('cleaning', 'colombo', JOB_LOCATION);

    expect((await waiting.api.get(`/api/bookings/${booking.id}`)).status).toBe(404);

    t.clock.advanceSeconds(OFFER_RESPONSE_WINDOW_MS / 1000 + 1);

    const res = await waiting.api.get(`/api/bookings/${booking.id}`);
    expect(res.status).toBe(200);
    expect(myOfferOf(res)).toMatchObject({ status: 'pending', wave: 2 });
  });
});

describe('dispatch: accept and submitQuote require a held offer', () => {
  it('rejects acceptance from an eligible provider who has not been offered this booking yet', async () => {
    await nearbyProviders(WAVE_SIZE);
    const waiting = await eligibleProvider(catalogue.cleaning); // unlocated: ranks last
    const booking = await createOnDemandBooking('cleaning', 'colombo', JOB_LOCATION);

    const res = await waiting.api.post(`/api/bookings/${booking.id}/accept`);
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('NO_ACTIVE_OFFER');
  });

  it('rejects acceptance from a provider who is not eligible at all', async () => {
    const provider = await eligibleProvider(catalogue.plumbing);
    const booking = await createOnDemandBooking('cleaning');

    const res = await provider.api.post(`/api/bookings/${booking.id}/accept`);
    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('PROVIDER_NOT_ELIGIBLE');
  });

  it('rejects a quote from a provider who was never offered this (quote-priced) booking', async () => {
    await nearbyProviders(WAVE_SIZE, catalogue.plumbing);
    const waiting = await eligibleProvider(catalogue.plumbing); // unlocated: ranks last
    const booking = await createOnDemandBooking('plumbing', 'colombo', JOB_LOCATION);

    const res = await waiting.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('NO_ACTIVE_OFFER');
  });

  it('lets an offered provider submit a quote', async () => {
    const provider = await eligibleProvider(catalogue.plumbing);
    const booking = await createOnDemandBooking('plumbing');

    const res = await provider.api.post(`/api/bookings/${booking.id}/quotes`, { amount: 100 });
    expect(res.status).toBe(201);
  });
});

describe('dispatch: booking expiration', () => {
  it('expires a booking nobody ever accepted once its matching window passes', async () => {
    const booking = await createOnDemandBooking('cleaning'); // no providers exist: nobody to offer

    t.clock.advanceSeconds(MATCHING_WINDOW_MS / 1000 + 1);
    // The access token minted in beforeEach has also lapsed by now: get a fresh one.
    const { api: freshCustomer } = await signInUser(t.app, t.sms, customerPhone);

    const res = await freshCustomer.get(`/api/bookings/${booking.id}`);
    expect(bookingOf(res).status).toBe('expired');
  });
});

describe('dispatch: provider cancellation and re-dispatch exclusions', () => {
  it('never re-offers the releasing provider, but can re-offer one who lost the first race', async () => {
    const first = await eligibleProvider(catalogue.cleaning);
    const second = await eligibleProvider(catalogue.cleaning);
    const booking = await createOnDemandBooking('cleaning');

    await first.api.post(`/api/bookings/${booking.id}/accept`);
    await first.api.post(`/api/bookings/${booking.id}/release`, { reason: 'Cannot make it.' });

    // second lost the original race (their offer was superseded) but is eligible again.
    const secondAccept = await second.api.post(`/api/bookings/${booking.id}/accept`);
    expect(secondAccept.status).toBe(200);
    expect(secondAccept.body).toMatchObject({ provider: { id: second.profileId } });

    // first must never be re-offered this booking again.
    const firstRes = await first.api.get(`/api/bookings/${booking.id}`);
    expect(myOfferOf(firstRes)?.status).not.toBe('pending');
  });

  it('a provider who explicitly declined stays excluded even after a later release', async () => {
    const decliner = await eligibleProvider(catalogue.cleaning);
    const accepter = await eligibleProvider(catalogue.cleaning);
    const booking = await createOnDemandBooking('cleaning');

    await decliner.api.post(`/api/bookings/${booking.id}/decline`);
    await accepter.api.post(`/api/bookings/${booking.id}/accept`);
    await accepter.api.post(`/api/bookings/${booking.id}/release`, { reason: 'Emergency.' });

    // A fresh wave ran; the decliner must not have a new pending offer.
    const res = await decliner.api.get(`/api/bookings/${booking.id}`);
    expect(myOfferOf(res)?.status).toBe('declined');
  });
});
