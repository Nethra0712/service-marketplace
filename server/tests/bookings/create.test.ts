import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../helpers/app.js';
import { createCatalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { apiFor, signInUser } from '../helpers/providers.js';
import { bookingOf, errorOf } from '../helpers/bookings.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(async () => {
  await resetDatabase(db);
  await createCatalogue(db);
});
afterAll(() => handle.close());

describe('POST /api/bookings', () => {
  it('creates an on-demand booking', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '12 Galle Road, Colombo 03',
      customerNotes: 'Please bring your own supplies.',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'searching',
      bookingType: 'on_demand',
      pricingModel: 'hourly',
      category: { slug: 'cleaning', name: 'Cleaning' },
      city: { slug: 'colombo' },
      serviceAddress: '12 Galle Road, Colombo 03',
      customerNotes: 'Please bring your own supplies.',
      scheduledAt: null,
      agreedAmount: null,
      provider: null,
      quotes: [],
    });
    expect(bookingOf(res).id).toBeTypeOf('string');
    expect(bookingOf(res).timestamps.createdAt).toBeTypeOf('string');
  });

  it('creates a scheduled booking with a future time', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    const scheduledAt = new Date(Date.now() + 24 * 3_600_000).toISOString();

    const res = await api.post('/api/bookings', {
      categorySlug: 'plumbing',
      citySlug: 'colombo',
      bookingType: 'scheduled',
      scheduledAt,
      serviceAddress: '5 Flower Road',
    });

    expect(res.status).toBe(201);
    expect(bookingOf(res).bookingType).toBe('scheduled');
    expect(bookingOf(res).scheduledAt).toBe(scheduledAt);
    expect(bookingOf(res).pricingModel).toBe('quote');
  });

  it('omits customerNotes when none were given', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Road',
    });

    expect(bookingOf(res).customerNotes).toBeNull();
  });

  it('rejects a scheduled booking with no scheduled time', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'scheduled',
      serviceAddress: '1 Test Road',
    });

    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
  });

  it('rejects an on-demand booking that supplies a scheduled time', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
      serviceAddress: '1 Test Road',
    });

    expect(res.status).toBe(400);
  });

  it('rejects a scheduled time in the past', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'scheduled',
      scheduledAt: new Date(Date.now() - 3_600_000).toISOString(),
      serviceAddress: '1 Test Road',
    });

    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res).details?.[0]?.path).toBe('scheduledAt');
  });

  it('rejects a category that is not offered in the given city', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'painting', // exists but not offered anywhere
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Road',
    });

    expect(res.status).toBe(404);
    expect(errorOf(res).code).toBe('NOT_FOUND');
  });

  it('rejects an inactive category', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'carpentry', // offered but inactive
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Road',
    });

    expect(res.status).toBe(404);
  });

  it('rejects an unknown city', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'kandy', // real category, wrong city (not offered there)
      bookingType: 'on_demand',
      serviceAddress: '1 Test Road',
    });

    expect(res.status).toBe(404);
  });

  it('rejects a blank service address', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '   ',
    });

    expect(res.status).toBe(400);
  });

  it('rejects fields the client has no business setting (mass assignment)', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Road',
      status: 'accepted',
      agreedAmount: '1.00',
    });

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const { app } = buildTestApp({ db });
    const res = await apiFor(app).post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Road',
    });

    expect(res.status).toBe(401);
  });

  it('follows ?lang= for the category name in the response', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/bookings?lang=si', {
      categorySlug: 'plumbing',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Road',
    });

    expect(bookingOf(res).category.name).toBe('ජලනල කටයුතු');
  });
});
