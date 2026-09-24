import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createReviewsService,
  type ReviewsService,
} from '../../src/modules/reviews/reviews.service.js';
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

let service: ReviewsService;

beforeEach(async () => {
  await resetDatabase(db);
  service = createReviewsService({ db });
});

/** A booking in `status`, with an assigned provider and every timestamp `completed` needs. */
async function bookingIn(status: 'searching' | 'accepted' | 'completed' | 'cancelled') {
  const city = await createCity(db);
  const category = await createOfferedCategory(db, city, {
    pricingModel: 'fixed',
    baseRate: '250.00',
  });
  const customer = await createUser(db);
  const { profile: provider } = await createApprovedProvider(db, category, city);
  const now = new Date();
  const booking = await createBooking(db, customer, category, city, {
    providerProfileId: status === 'searching' ? null : provider.id,
    status,
    agreedAmount: status === 'searching' ? null : '250.00',
    acceptedAt: status === 'searching' ? null : now,
    enRouteAt: status === 'completed' ? now : null,
    arrivedAt: status === 'completed' ? now : null,
    workStartedAt: status === 'completed' ? now : null,
    completedAt: status === 'completed' ? now : null,
    cancelledAt: status === 'cancelled' ? now : null,
    cancelledByUserId: status === 'cancelled' ? customer.id : null,
  });
  return { booking, customer, provider };
}

describe('submitReview', () => {
  it('a customer can review the provider on a completed booking', async () => {
    const { booking, customer, provider } = await bookingIn('completed');
    const review = await service.submitReview(customer.id, booking.id, {
      rating: 5,
      comment: 'Great!',
    });
    expect(review).toMatchObject({
      bookingId: booking.id,
      rating: 5,
      comment: 'Great!',
      isMine: true,
    });

    const summary = await service.getProviderRatingSummary(provider.id);
    expect(summary).toEqual({ averageRating: 5, ratingCount: 1 });
  });

  it('the provider can review the customer back (two-sided)', async () => {
    const { booking, customer, provider } = await bookingIn('completed');
    await service.submitReview(customer.id, booking.id, { rating: 5 });

    const review = await service.submitReview(provider.userId, booking.id, {
      rating: 4,
      comment: 'Paid promptly.',
    });
    expect(review).toMatchObject({ rating: 4, comment: 'Paid promptly.' });
  });

  it('rejects a stranger who is not a participant in the booking', async () => {
    const { booking } = await bookingIn('completed');
    const stranger = await createUser(db);
    await expect(
      service.submitReview(stranger.id, booking.id, { rating: 5 }),
    ).rejects.toMatchObject({
      code: 'NOT_BOOKING_PARTICIPANT',
    });
  });

  it.each(['searching', 'accepted', 'cancelled'] as const)(
    'rejects a booking that is not completed (status: %s)',
    async (status) => {
      const { booking, customer } = await bookingIn(status);
      await expect(
        service.submitReview(customer.id, booking.id, { rating: 5 }),
      ).rejects.toMatchObject({
        code: 'BOOKING_NOT_COMPLETED',
      });
    },
  );

  it('prevents a second review by the same author on the same booking', async () => {
    const { booking, customer } = await bookingIn('completed');
    await service.submitReview(customer.id, booking.id, { rating: 5 });

    await expect(
      service.submitReview(customer.id, booking.id, { rating: 1 }),
    ).rejects.toMatchObject({
      code: 'ALREADY_REVIEWED',
    });
  });

  it('a booking that does not exist 404s', async () => {
    const customer = await createUser(db);
    await expect(
      service.submitReview(customer.id, '00000000-0000-4000-8000-000000000000', { rating: 5 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('an empty/blank comment is stored as no comment, not an empty string', async () => {
    const { booking, customer } = await bookingIn('completed');
    const review = await service.submitReview(customer.id, booking.id, {
      rating: 3,
      comment: '   ',
    });
    expect(review.comment).toBeNull();
  });
});

describe('getForBooking', () => {
  it("shows the caller their own review and the counterpart's, correctly attributed", async () => {
    const { booking, customer, provider } = await bookingIn('completed');
    await service.submitReview(customer.id, booking.id, { rating: 5, comment: 'From customer' });
    await service.submitReview(provider.userId, booking.id, {
      rating: 4,
      comment: 'From provider',
    });

    const asCustomer = await service.getForBooking(customer.id, booking.id);
    expect(asCustomer.mine).toMatchObject({ rating: 5, comment: 'From customer', isMine: true });
    expect(asCustomer.theirs).toMatchObject({ rating: 4, comment: 'From provider', isMine: false });

    const asProvider = await service.getForBooking(provider.userId, booking.id);
    expect(asProvider.mine).toMatchObject({ rating: 4, isMine: true });
    expect(asProvider.theirs).toMatchObject({ rating: 5, isMine: false });
  });

  it('both are null until anyone has reviewed', async () => {
    const { booking, customer } = await bookingIn('completed');
    expect(await service.getForBooking(customer.id, booking.id)).toEqual({
      mine: null,
      theirs: null,
    });
  });

  it('rejects a viewer who is not a participant', async () => {
    const { booking } = await bookingIn('completed');
    const stranger = await createUser(db);
    await expect(service.getForBooking(stranger.id, booking.id)).rejects.toMatchObject({
      code: 'NOT_BOOKING_PARTICIPANT',
    });
  });
});

describe('getProviderRatingSummary: safe, server-computed aggregate ratings', () => {
  it('averages across several bookings, never trusting a client-supplied aggregate', async () => {
    const first = await bookingIn('completed');
    // A second booking for the SAME provider, reviewed by a different customer.
    const city = await createCity(db, { slug: 'kandy', name: 'Kandy' });
    const category = await createOfferedCategory(db, city, {
      slug: 'gardening',
      pricingModel: 'fixed',
      baseRate: '250.00',
    });
    const secondCustomer = await createUser(db);
    const now = new Date();
    const secondBooking = await createBooking(db, secondCustomer, category, city, {
      providerProfileId: first.provider.id,
      status: 'completed',
      agreedAmount: '250.00',
      acceptedAt: now,
      enRouteAt: now,
      arrivedAt: now,
      workStartedAt: now,
      completedAt: now,
    });

    await service.submitReview(first.customer.id, first.booking.id, { rating: 5 });
    await service.submitReview(secondCustomer.id, secondBooking.id, { rating: 3 });

    expect(await service.getProviderRatingSummary(first.provider.id)).toEqual({
      averageRating: 4,
      ratingCount: 2,
    });
  });

  it('a provider with no reviews yet has a null average and zero count, not an error', async () => {
    const { provider } = await bookingIn('completed');
    expect(await service.getProviderRatingSummary(provider.id)).toEqual({
      averageRating: null,
      ratingCount: 0,
    });
  });

  it('404s for a provider profile that does not exist', async () => {
    await expect(
      service.getProviderRatingSummary('00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it("reviews the OTHER direction (a provider reviewing customers) never pollute the provider's own rating", async () => {
    const { booking, provider } = await bookingIn('completed');
    await service.submitReview(provider.userId, booking.id, { rating: 1 }); // provider rates the customer
    // The provider's OWN rating (as a service provider) is unaffected: nobody has reviewed them.
    expect(await service.getProviderRatingSummary(provider.id)).toEqual({
      averageRating: null,
      ratingCount: 0,
    });
  });
});
