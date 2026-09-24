import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../helpers/app.js';
import { errorOf } from '../helpers/bookings.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { completedBooking, type CompletedBooking } from '../helpers/payments.js';
import { signInUser } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;
afterAll(() => handle.close());

let t: TestApp;
let catalogue: Catalogue;

beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
});

async function reviewedBooking(): Promise<CompletedBooking> {
  return completedBooking(t, db, catalogue);
}

describe('POST /api/bookings/:id/review', () => {
  it('requires authentication', async () => {
    const booking = await reviewedBooking();
    const res = await request(t.app)
      .post(`/api/bookings/${booking.bookingId}/review`)
      .send({ rating: 5 });
    expect(res.status).toBe(401);
  });

  it('lets the customer review the provider', async () => {
    const booking = await reviewedBooking();
    const res = await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, {
      rating: 5,
      comment: 'Excellent work.',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ rating: 5, comment: 'Excellent work.', isMine: true });
  });

  it('lets the assigned provider review the customer back', async () => {
    const booking = await reviewedBooking();
    const res = await booking.providerApi.post(`/api/bookings/${booking.bookingId}/review`, {
      rating: 4,
    });
    expect(res.status).toBe(201);
  });

  it('404s for a booking that does not exist', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.post('/api/bookings/00000000-0000-4000-8000-000000000000/review', {
      rating: 5,
    });
    expect(res.status).toBe(404);
  });

  it('403s (a stable, machine-readable code) for a stranger who is not a participant', async () => {
    const booking = await reviewedBooking();
    const { api: stranger } = await signInUser(t.app, t.sms);
    const res = await stranger.post(`/api/bookings/${booking.bookingId}/review`, { rating: 5 });
    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('NOT_BOOKING_PARTICIPANT');
  });

  it('refuses a review before the booking is completed', async () => {
    const { api: customer } = await signInUser(t.app, t.sms);
    const created = await customer.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Rd',
    });
    const bookingId = (created.body as { id: string }).id;

    const res = await customer.post(`/api/bookings/${bookingId}/review`, { rating: 5 });
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('BOOKING_NOT_COMPLETED');
  });

  it('prevents a second review by the same author on the same booking', async () => {
    const booking = await reviewedBooking();
    await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, { rating: 5 });
    const res = await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, {
      rating: 1,
    });
    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('ALREADY_REVIEWED');
  });

  it.each([0, 6, -1, 3.5])('rejects an out-of-range rating (%s)', async (rating) => {
    const booking = await reviewedBooking();
    const res = await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, {
      rating,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a comment longer than 1000 characters', async () => {
    const booking = await reviewedBooking();
    const res = await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, {
      rating: 5,
      comment: 'x'.repeat(1001),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/bookings/:id/reviews', () => {
  it('requires authentication', async () => {
    const booking = await reviewedBooking();
    const res = await request(t.app).get(`/api/bookings/${booking.bookingId}/reviews`);
    expect(res.status).toBe(401);
  });

  it("shows the counterpart's review once they have submitted one, attributed correctly", async () => {
    const booking = await reviewedBooking();
    await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, { rating: 5 });
    await booking.providerApi.post(`/api/bookings/${booking.bookingId}/review`, { rating: 4 });

    const asCustomer = await booking.customer.get(`/api/bookings/${booking.bookingId}/reviews`);
    expect(asCustomer.body).toMatchObject({
      mine: { rating: 5, isMine: true },
      theirs: { rating: 4, isMine: false },
    });
  });
});

describe('GET /api/reviews/providers/:providerProfileId/summary', () => {
  it('requires authentication', async () => {
    const booking = await reviewedBooking();
    const res = await request(t.app).get(
      `/api/reviews/providers/${booking.providerProfileId}/summary`,
    );
    expect(res.status).toBe(401);
  });

  it('reflects a submitted rating, never a client-supplied aggregate', async () => {
    const booking = await reviewedBooking();
    await booking.customer.post(`/api/bookings/${booking.bookingId}/review`, { rating: 5 });

    const res = await booking.customer.get(
      `/api/reviews/providers/${booking.providerProfileId}/summary`,
    );
    expect(res.body).toEqual({ averageRating: 5, ratingCount: 1 });
  });

  it('404s for a provider profile that does not exist', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.get(
      '/api/reviews/providers/00000000-0000-4000-8000-000000000000/summary',
    );
    expect(res.status).toBe(404);
  });
});
