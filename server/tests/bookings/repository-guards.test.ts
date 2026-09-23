import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createBookingsRepository } from '../../src/modules/bookings/bookings.repository.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider, createBooking, createUser } from '../helpers/factories.js';

/**
 * The service layer pre-checks state before calling these, so an HTTP test can
 * never observe what happens if the repository's OWN guard were missing (the
 * service's check always fires first). These tests call the repository
 * directly to prove each conditional update is independently correct: it is
 * the last line of defence against a lost race between two requests, and it
 * must hold even if a future caller skips the service's pre-checks.
 */
const handle = createTestDatabase();
const { db } = handle;
const repo = createBookingsRepository(db);

let catalogue: Catalogue;
beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
});
afterAll(() => handle.close());

describe('acceptDirect', () => {
  it('refuses a quote-priced booking even if it is searching and unassigned', async () => {
    const customer = await createUser(db);
    const booking = await createBooking(db, customer, catalogue.plumbing, catalogue.colombo, {
      pricingModel: 'quote',
    });
    const { profile } = await createApprovedProvider(db, catalogue.plumbing, catalogue.colombo);

    expect(await repo.acceptDirect(booking.id, profile.id, new Date())).toBe(false);
  });

  it('refuses a booking that is not searching', async () => {
    const customer = await createUser(db);
    const booking = await createBooking(db, customer, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledByUserId: customer.id,
    });
    const { profile } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);

    expect(await repo.acceptDirect(booking.id, profile.id, new Date())).toBe(false);
  });

  it('refuses a booking that already has a provider', async () => {
    const customer = await createUser(db);
    const { profile: already } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    const booking = await createBooking(db, customer, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
      status: 'accepted',
      providerProfileId: already.id,
      acceptedAt: new Date(),
    });
    const { profile: rival } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );

    expect(await repo.acceptDirect(booking.id, rival.id, new Date())).toBe(false);
  });

  it('succeeds for a searching, unassigned, non-quote booking', async () => {
    const customer = await createUser(db);
    const booking = await createBooking(db, customer, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
    });
    const { profile } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);

    expect(await repo.acceptDirect(booking.id, profile.id, new Date())).toBe(true);
  });
});

describe('the provider progression steps are scoped to the assigned provider AND the right stage', () => {
  async function assignedBooking(status: 'accepted' | 'en_route' | 'arrived' | 'in_progress') {
    const customer = await createUser(db);
    const { profile } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);
    const booking = await createBooking(db, customer, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
      status,
      providerProfileId: profile.id,
      acceptedAt: new Date(),
      enRouteAt: ['en_route', 'arrived', 'in_progress'].includes(status) ? new Date() : null,
      arrivedAt: ['arrived', 'in_progress'].includes(status) ? new Date() : null,
      workStartedAt: status === 'in_progress' ? new Date() : null,
    });
    const { profile: stranger } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    return { booking, profile, stranger };
  }

  it.each([
    ['startEnRoute', 'accepted'],
    ['markArrived', 'en_route'],
    ['startWork', 'arrived'],
    ['complete', 'in_progress'],
  ] as const)(
    '%s refuses a provider who is not assigned to the booking',
    async (method, status) => {
      const { booking, stranger } = await assignedBooking(status);
      expect(await repo[method](booking.id, stranger.id, new Date())).toBe(false);
    },
  );

  it.each([
    ['startEnRoute', 'en_route'], // already past `accepted`
    ['markArrived', 'arrived'], // already past `en_route`
    ['startWork', 'in_progress'], // already past `arrived`
  ] as const)(
    '%s refuses the assigned provider when the stage has already moved on',
    async (method, status) => {
      const { booking, profile } = await assignedBooking(status);
      expect(await repo[method](booking.id, profile.id, new Date())).toBe(false);
    },
  );

  it('complete refuses the assigned provider from "accepted" (too early)', async () => {
    const { booking, profile } = await assignedBooking('accepted');
    expect(await repo.complete(booking.id, profile.id, new Date())).toBe(false);
  });
});

describe('releaseAssignment', () => {
  it('refuses a provider who is not assigned', async () => {
    const customer = await createUser(db);
    const { profile: assigned } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    const booking = await createBooking(db, customer, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
      status: 'accepted',
      providerProfileId: assigned.id,
      acceptedAt: new Date(),
    });
    const { profile: stranger } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );

    expect(await repo.releaseAssignment(booking.id, stranger.id)).toBe(false);
  });

  it('refuses once work has started', async () => {
    const customer = await createUser(db);
    const { profile } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);
    const booking = await createBooking(db, customer, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
      status: 'in_progress',
      providerProfileId: profile.id,
      acceptedAt: new Date(),
      enRouteAt: new Date(),
      arrivedAt: new Date(),
      workStartedAt: new Date(),
    });

    expect(await repo.releaseAssignment(booking.id, profile.id)).toBe(false);
  });

  it('refuses a searching (never-assigned) booking', async () => {
    const customer = await createUser(db);
    const booking = await createBooking(db, customer, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
    });
    const { profile } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);

    expect(await repo.releaseAssignment(booking.id, profile.id)).toBe(false);
  });
});

describe('cancelByCustomer', () => {
  it('refuses a different customer', async () => {
    const owner = await createUser(db);
    const stranger = await createUser(db);
    const booking = await createBooking(db, owner, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
    });

    expect(await repo.cancelByCustomer(booking.id, stranger.id, 'x', new Date())).toBe(false);
  });

  it('refuses a booking that is already in progress', async () => {
    const owner = await createUser(db);
    const { profile } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);
    const booking = await createBooking(db, owner, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
      status: 'in_progress',
      providerProfileId: profile.id,
      acceptedAt: new Date(),
      enRouteAt: new Date(),
      arrivedAt: new Date(),
      workStartedAt: new Date(),
    });

    expect(await repo.cancelByCustomer(booking.id, owner.id, 'x', new Date())).toBe(false);
  });

  it('succeeds for the owning customer while searching', async () => {
    const owner = await createUser(db);
    const booking = await createBooking(db, owner, catalogue.cleaning, catalogue.colombo, {
      pricingModel: 'hourly',
    });

    expect(await repo.cancelByCustomer(booking.id, owner.id, 'x', new Date())).toBe(true);
  });
});

describe('quote acceptance primitives', () => {
  it('acceptQuoteOnBooking refuses a booking that is not searching', async () => {
    const owner = await createUser(db);
    const { profile } = await createApprovedProvider(db, catalogue.plumbing, catalogue.colombo);
    const booking = await createBooking(db, owner, catalogue.plumbing, catalogue.colombo, {
      pricingModel: 'quote',
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledByUserId: owner.id,
    });

    expect(await repo.acceptQuoteOnBooking(booking.id, profile.id, '100.00', new Date())).toBe(
      false,
    );
  });

  it('markQuoteAccepted refuses a quote that already has a response', async () => {
    const owner = await createUser(db);
    const { profile } = await createApprovedProvider(db, catalogue.plumbing, catalogue.colombo);
    const booking = await createBooking(db, owner, catalogue.plumbing, catalogue.colombo, {
      pricingModel: 'quote',
    });
    const { id: quoteId } = await repo.insertQuote(booking.id, profile.id, '100.00', null);
    await repo.rejectQuote(quoteId, new Date());

    expect(await repo.markQuoteAccepted(quoteId, new Date())).toBe(false);
  });

  it('rejectQuote refuses a quote that was already accepted', async () => {
    const owner = await createUser(db);
    const { profile } = await createApprovedProvider(db, catalogue.plumbing, catalogue.colombo);
    const booking = await createBooking(db, owner, catalogue.plumbing, catalogue.colombo, {
      pricingModel: 'quote',
    });
    const { id: quoteId } = await repo.insertQuote(booking.id, profile.id, '100.00', null);
    await repo.markQuoteAccepted(quoteId, new Date());

    expect(await repo.rejectQuote(quoteId, new Date())).toBe(false);
  });

  it('rejectOtherPendingQuotes never touches the winning quote or already-decided ones', async () => {
    const owner = await createUser(db);
    const booking = await createBooking(db, owner, catalogue.plumbing, catalogue.colombo, {
      pricingModel: 'quote',
    });
    const { profile: winner } = await createApprovedProvider(
      db,
      catalogue.plumbing,
      catalogue.colombo,
    );
    const { profile: loserA } = await createApprovedProvider(
      db,
      catalogue.plumbing,
      catalogue.colombo,
    );
    const { profile: loserB } = await createApprovedProvider(
      db,
      catalogue.plumbing,
      catalogue.colombo,
    );
    const winningQuote = await repo.insertQuote(booking.id, winner.id, '100.00', null);
    const pendingLoser = await repo.insertQuote(booking.id, loserA.id, '120.00', null);
    const alreadyRejected = await repo.insertQuote(booking.id, loserB.id, '130.00', null);
    await repo.rejectQuote(alreadyRejected.id, new Date());
    await repo.markQuoteAccepted(winningQuote.id, new Date());

    await repo.rejectOtherPendingQuotes(booking.id, winningQuote.id, new Date());

    const quotes = await repo.listQuotesForBooking(booking.id);
    const byId = new Map(quotes.map((q) => [q.id, q.status]));
    expect(byId.get(winningQuote.id)).toBe('accepted');
    expect(byId.get(pendingLoser.id)).toBe('rejected');
    expect(byId.get(alreadyRejected.id)).toBe('rejected');
  });
});
