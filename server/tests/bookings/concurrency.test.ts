import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { bookingOffers, bookings } from '../../src/db/schema/index.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { firstQuote, providerOf } from '../helpers/bookings.js';
import { createApprovedProvider } from '../helpers/factories.js';
import { signInUser, type Api } from '../helpers/providers.js';

/**
 * Concurrency is the one hard requirement in this sprint's brief: two
 * providers must never both win the same booking. These tests fire genuinely
 * concurrent HTTP requests (via `Promise.all`, so the two accept attempts'
 * database round-trips actually interleave) rather than asserting on the
 * sequential guard logic alone.
 */
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

describe('concurrent acceptance', () => {
  it('lets exactly one of two simultaneous accept attempts win', async () => {
    const a = await eligibleProvider();
    const b = await eligibleProvider();
    const booking = await createOnDemandBooking();

    const [resA, resB] = await Promise.all([
      a.api.post(`/api/bookings/${booking.id}/accept`),
      b.api.post(`/api/bookings/${booking.id}/accept`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = resA.status === 200 ? resA : resB;
    const winnerProfileId = providerOf(winner).id;
    expect([a.profileId, b.profileId]).toContain(winnerProfileId);

    // The database agrees: exactly one provider assigned, exactly one accepted offer.
    const [row] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(row?.status).toBe('accepted');
    expect(row?.providerProfileId).toBe(winnerProfileId);

    const offers = await db
      .select()
      .from(bookingOffers)
      .where(eq(bookingOffers.bookingId, booking.id));
    const accepted = offers.filter((o) => o.status === 'accepted');
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.providerProfileId).toBe(winnerProfileId);
  });

  it('lets exactly one of three simultaneous accept attempts win (a full wave)', async () => {
    const a = await eligibleProvider();
    const b = await eligibleProvider();
    const c = await eligibleProvider();
    const booking = await createOnDemandBooking();

    const results = await Promise.all([
      a.api.post(`/api/bookings/${booking.id}/accept`),
      b.api.post(`/api/bookings/${booking.id}/accept`),
      c.api.post(`/api/bookings/${booking.id}/accept`),
    ]);

    const winners = results.filter((r) => r.status === 200);
    const losers = results.filter((r) => r.status === 409);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(2);

    const offers = await db
      .select()
      .from(bookingOffers)
      .where(eq(bookingOffers.bookingId, booking.id));
    expect(offers.filter((o) => o.status === 'accepted')).toHaveLength(1);
  });

  it('repeatedly racing the same booking never produces two winners', async () => {
    // A single run can pass by luck if the two requests happen not to overlap.
    // Repeating it several times makes that far less likely to go unnoticed.
    for (let trial = 0; trial < 10; trial += 1) {
      await resetDatabase(db);
      catalogue = await createCatalogue(db);
      t = buildTestApp({ db });
      ({ api: customer } = await signInUser(t.app, t.sms));

      const a = await eligibleProvider();
      const b = await eligibleProvider();
      const booking = await createOnDemandBooking();

      const [resA, resB] = await Promise.all([
        a.api.post(`/api/bookings/${booking.id}/accept`),
        b.api.post(`/api/bookings/${booking.id}/accept`),
      ]);

      const successes = [resA, resB].filter((r) => r.status === 200);
      expect(successes).toHaveLength(1);
    }
  });
});

describe('concurrent quote acceptance', () => {
  it('lets exactly one of two simultaneous quote-accept attempts win', async () => {
    const providerA = await eligibleProvider(catalogue.plumbing);
    const providerB = await eligibleProvider(catalogue.plumbing);
    const booking = await createOnDemandBooking('plumbing');

    const quoteA = await providerA.api.post(`/api/bookings/${booking.id}/quotes`, {
      amount: 100,
    });
    const quoteB = await providerB.api.post(`/api/bookings/${booking.id}/quotes`, {
      amount: 90,
    });
    expect(quoteA.status).toBe(201);
    expect(quoteB.status).toBe(201);
    // Each provider's own response shows only their own quote (never a competitor's).
    const quoteAId = firstQuote(quoteA).id;
    const quoteBId = firstQuote(quoteB).id;

    const [resA, resB] = await Promise.all([
      customer.post(`/api/bookings/${booking.id}/quotes/${quoteAId}/accept`),
      customer.post(`/api/bookings/${booking.id}/quotes/${quoteBId}/accept`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const [row] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(row?.status).toBe('accepted');
  });
});
