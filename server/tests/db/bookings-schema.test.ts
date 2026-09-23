import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  bookingProviderReleases,
  bookingQuotes,
  bookings,
  cities,
  serviceCategories,
} from '../../src/db/schema/index.js';
import { createTestDatabase, expectPgError, PgCode, resetDatabase } from '../helpers/database.js';
import {
  createApprovedProvider,
  createBooking,
  createCity,
  createOfferedCategory,
  createUser,
  only,
} from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

let customer: Awaited<ReturnType<typeof createUser>>;
let city: Awaited<ReturnType<typeof createCity>>;
let category: Awaited<ReturnType<typeof createOfferedCategory>>;

beforeEach(async () => {
  await resetDatabase(db);
  customer = await createUser(db);
  city = await createCity(db);
  category = await createOfferedCategory(db, city, { pricingModel: 'quote' });
});
afterAll(() => handle.close());

describe('bookings', () => {
  it('starts searching, unassigned, with no timestamps but createdAt/updatedAt', async () => {
    const booking = await createBooking(db, customer, category, city);

    expect(booking).toMatchObject({
      status: 'searching',
      bookingType: 'on_demand',
      pricingModel: 'quote',
      providerProfileId: null,
      scheduledAt: null,
      agreedAmount: null,
      acceptedAt: null,
      enRouteAt: null,
      arrivedAt: null,
      workStartedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReason: null,
    });
    expect(booking.createdAt).toBeInstanceOf(Date);
  });

  it('maintains updated_at', async () => {
    const booking = await createBooking(db, customer, category, city);
    await db
      .update(bookings)
      .set({ customerNotes: 'Ring the bell twice.' })
      .where(eq(bookings.id, booking.id));
    const after = only(await db.select().from(bookings).where(eq(bookings.id, booking.id)));
    expect(after.updatedAt.getTime()).toBeGreaterThan(booking.updatedAt.getTime());
  });

  describe('scheduled_at must match booking_type', () => {
    it('rejects a scheduled booking with no scheduled time', async () => {
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, { bookingType: 'scheduled' }),
      );
      expect(error).toEqual({
        code: PgCode.checkViolation,
        constraint: 'bookings_scheduled_at_matches_type',
      });
    });

    it('rejects an on-demand booking with a scheduled time', async () => {
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, { scheduledAt: new Date() }),
      );
      expect(error).toEqual({
        code: PgCode.checkViolation,
        constraint: 'bookings_scheduled_at_matches_type',
      });
    });

    it('accepts a scheduled booking with a scheduled time', async () => {
      const booking = await createBooking(db, customer, category, city, {
        bookingType: 'scheduled',
        scheduledAt: new Date(Date.now() + 3_600_000),
      });
      expect(booking.scheduledAt).toBeInstanceOf(Date);
    });
  });

  it.each([
    ['a blank address', { serviceAddress: '   ' }, 'bookings_service_address_valid'],
    [
      'an address over 500 characters',
      { serviceAddress: 'x'.repeat(501) },
      'bookings_service_address_valid',
    ],
    ['a blank note', { customerNotes: '   ' }, 'bookings_customer_notes_valid'],
    [
      'a note over 1000 characters',
      { customerNotes: 'x'.repeat(1001) },
      'bookings_customer_notes_valid',
    ],
    ['a non-positive agreed amount', { agreedAmount: '0' }, 'bookings_agreed_amount_positive'],
  ])('rejects %s', async (_name, override, constraint) => {
    const error = await expectPgError(() => createBooking(db, customer, category, city, override));
    expect(error).toEqual({ code: PgCode.checkViolation, constraint });
  });

  it('a null customer_notes is fine (it is optional)', async () => {
    const booking = await createBooking(db, customer, category, city, { customerNotes: null });
    expect(booking.customerNotes).toBeNull();
  });

  describe('provider_profile_id must match status', () => {
    it('rejects a searching booking with a provider assigned', async () => {
      const { profile } = await createApprovedProvider(db, category, city);
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, { providerProfileId: profile.id }),
      );
      expect(error).toEqual({
        code: PgCode.checkViolation,
        constraint: 'bookings_provider_matches_status',
      });
    });

    it.each(['accepted', 'en_route', 'arrived', 'in_progress', 'completed'] as const)(
      'rejects an unassigned "%s" booking',
      async (status) => {
        const error = await expectPgError(() =>
          createBooking(db, customer, category, city, {
            status,
            acceptedAt: new Date(),
            enRouteAt: status === 'accepted' ? null : new Date(),
            arrivedAt: ['arrived', 'in_progress', 'completed'].includes(status) ? new Date() : null,
            workStartedAt: ['in_progress', 'completed'].includes(status) ? new Date() : null,
            completedAt: status === 'completed' ? new Date() : null,
          }),
        );
        expect(error.constraint).toBe('bookings_provider_matches_status');
      },
    );

    it('accepts an assigned "accepted" booking', async () => {
      const { profile } = await createApprovedProvider(db, category, city);
      const booking = await createBooking(db, customer, category, city, {
        status: 'accepted',
        providerProfileId: profile.id,
        acceptedAt: new Date(),
      });
      expect(booking.providerProfileId).toBe(profile.id);
    });
  });

  describe('stage timestamps only move forward with status', () => {
    it.each([
      ['accepted', 'bookings_accepted_at_progression', {}],
      ['en_route', 'bookings_en_route_at_progression', { acceptedAt: new Date() }],
      [
        'arrived',
        'bookings_arrived_at_progression',
        { acceptedAt: new Date(), enRouteAt: new Date() },
      ],
      [
        'in_progress',
        'bookings_work_started_at_progression',
        { acceptedAt: new Date(), enRouteAt: new Date(), arrivedAt: new Date() },
      ],
    ] as const)('rejects "%s" missing its own timestamp', async (status, constraint, partial) => {
      const { profile } = await createApprovedProvider(db, category, city);
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, {
          status,
          providerProfileId: profile.id,
          ...partial,
        }),
      );
      expect(error.constraint).toBe(constraint);
    });

    it('accepts a fully progressed in_progress booking', async () => {
      const { profile } = await createApprovedProvider(db, category, city);
      const booking = await createBooking(db, customer, category, city, {
        status: 'in_progress',
        providerProfileId: profile.id,
        acceptedAt: new Date(),
        enRouteAt: new Date(),
        arrivedAt: new Date(),
        workStartedAt: new Date(),
      });
      expect(booking.status).toBe('in_progress');
    });
  });

  describe('completed_at matches status exactly', () => {
    it('rejects "completed" with no completed_at', async () => {
      const { profile } = await createApprovedProvider(db, category, city);
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, {
          status: 'completed',
          providerProfileId: profile.id,
          acceptedAt: new Date(),
          enRouteAt: new Date(),
          arrivedAt: new Date(),
          workStartedAt: new Date(),
        }),
      );
      expect(error.constraint).toBe('bookings_completed_at_matches_status');
    });

    it('rejects a completed_at set on a booking that is not completed', async () => {
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, { completedAt: new Date() }),
      );
      expect(error.constraint).toBe('bookings_completed_at_matches_status');
    });
  });

  describe('cancellation fields match status together', () => {
    it('rejects "cancelled" with no cancelled_at', async () => {
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, {
          status: 'cancelled',
          cancelledByUserId: customer.id,
        }),
      );
      expect(error.constraint).toBe('bookings_cancellation_matches_status');
    });

    it('rejects a cancelled_at with no cancelled_by_user_id', async () => {
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, {
          status: 'cancelled',
          cancelledAt: new Date(),
        }),
      );
      expect(error.constraint).toBe('bookings_cancellation_matches_status');
    });

    it('rejects a cancelled_by_user_id set on a booking that is not cancelled', async () => {
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, { cancelledByUserId: customer.id }),
      );
      expect(error.constraint).toBe('bookings_cancellation_matches_status');
    });

    it('rejects a blank cancellation reason', async () => {
      const error = await expectPgError(() =>
        createBooking(db, customer, category, city, {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledByUserId: customer.id,
          cancellationReason: '   ',
        }),
      );
      expect(error.constraint).toBe('bookings_cancellation_reason_valid');
    });

    it('accepts a fully cancelled booking with a reason', async () => {
      const booking = await createBooking(db, customer, category, city, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledByUserId: customer.id,
        cancellationReason: 'Changed my mind.',
      });
      expect(booking.status).toBe('cancelled');
    });

    it('accepts a cancellation with no reason (reason is optional)', async () => {
      const booking = await createBooking(db, customer, category, city, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledByUserId: customer.id,
      });
      expect(booking.cancellationReason).toBeNull();
    });
  });

  it('rejects an unknown status', async () => {
    const error = await expectPgError(() =>
      db.execute(sql`update bookings set status = 'matched' where id = (select id from bookings)`),
    );
    expect(error.code).toBe(PgCode.invalidEnumValue);
  });

  it('cannot reference a missing customer, category, city or provider', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const base = {
      bookingType: 'on_demand' as const,
      pricingModel: 'quote' as const,
      serviceAddress: '1 Test Road',
    };

    const badCustomer = await expectPgError(() =>
      db.insert(bookings).values({
        ...base,
        customerId: missing,
        serviceCategoryId: category.id,
        cityId: city.id,
      }),
    );
    const badCategory = await expectPgError(() =>
      db
        .insert(bookings)
        .values({ ...base, customerId: customer.id, serviceCategoryId: missing, cityId: city.id }),
    );
    const badCity = await expectPgError(() =>
      db.insert(bookings).values({
        ...base,
        customerId: customer.id,
        serviceCategoryId: category.id,
        cityId: missing,
      }),
    );

    expect(badCustomer.code).toBe(PgCode.foreignKeyViolation);
    expect(badCategory.code).toBe(PgCode.foreignKeyViolation);
    expect(badCity.code).toBe(PgCode.foreignKeyViolation);
  });

  it('cannot delete a city, category or user that a booking references', async () => {
    await createBooking(db, customer, category, city);

    const deleteCity = await expectPgError(() => db.delete(cities).where(eq(cities.id, city.id)));
    const deleteCategory = await expectPgError(() =>
      db.delete(serviceCategories).where(eq(serviceCategories.id, category.id)),
    );

    expect(deleteCity.code).toBe(PgCode.foreignKeyViolation);
    expect(deleteCategory.code).toBe(PgCode.foreignKeyViolation);
  });
});

describe('booking_quotes', () => {
  it('starts pending with no response', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);

    const [quote] = await db
      .insert(bookingQuotes)
      .values({ bookingId: booking.id, providerProfileId: profile.id, amount: '2500.00' })
      .returning();

    expect(quote).toMatchObject({ status: 'pending', respondedAt: null, note: null });
  });

  it('maintains updated_at', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);
    const quote = only(
      await db
        .insert(bookingQuotes)
        .values({ bookingId: booking.id, providerProfileId: profile.id, amount: '2500.00' })
        .returning(),
    );
    await db
      .update(bookingQuotes)
      .set({ status: 'accepted', respondedAt: new Date() })
      .where(eq(bookingQuotes.id, quote.id));
    const after = only(await db.select().from(bookingQuotes).where(eq(bookingQuotes.id, quote.id)));
    expect(after.updatedAt.getTime()).toBeGreaterThan(quote.updatedAt.getTime());
  });

  it.each([
    ['a zero amount', { amount: '0' }, 'booking_quotes_amount_positive'],
    ['a negative amount', { amount: '-5' }, 'booking_quotes_amount_positive'],
    ['a blank note', { note: '   ' }, 'booking_quotes_note_valid'],
    ['a note over 500 characters', { note: 'x'.repeat(501) }, 'booking_quotes_note_valid'],
  ])('rejects %s', async (_name, override, constraint) => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);

    const error = await expectPgError(() =>
      db.insert(bookingQuotes).values({
        bookingId: booking.id,
        providerProfileId: profile.id,
        amount: '100.00',
        ...override,
      }),
    );
    expect(error).toEqual({ code: PgCode.checkViolation, constraint });
  });

  it('requires a response time for anything but pending', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);

    const error = await expectPgError(() =>
      db.insert(bookingQuotes).values({
        bookingId: booking.id,
        providerProfileId: profile.id,
        amount: '100.00',
        status: 'accepted',
      }),
    );
    expect(error.constraint).toBe('booking_quotes_responded_at_matches_status');
  });

  it('rejects a response time on a pending quote', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);

    const error = await expectPgError(() =>
      db.insert(bookingQuotes).values({
        bookingId: booking.id,
        providerProfileId: profile.id,
        amount: '100.00',
        respondedAt: new Date(),
      }),
    );
    expect(error.constraint).toBe('booking_quotes_responded_at_matches_status');
  });

  it('allows only one active (pending or accepted) quote per provider per booking', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);
    await db
      .insert(bookingQuotes)
      .values({ bookingId: booking.id, providerProfileId: profile.id, amount: '100.00' });

    const error = await expectPgError(() =>
      db
        .insert(bookingQuotes)
        .values({ bookingId: booking.id, providerProfileId: profile.id, amount: '150.00' }),
    );
    expect(error).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'booking_quotes_booking_provider_active_uidx',
    });
  });

  it('lets a provider quote again after their previous quote was rejected', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);
    await db.insert(bookingQuotes).values({
      bookingId: booking.id,
      providerProfileId: profile.id,
      amount: '100.00',
      status: 'rejected',
      respondedAt: new Date(),
    });

    const again = only(
      await db
        .insert(bookingQuotes)
        .values({ bookingId: booking.id, providerProfileId: profile.id, amount: '150.00' })
        .returning(),
    );
    expect(again.status).toBe('pending');
  });

  it('allows only one accepted quote per booking', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile: providerA } = await createApprovedProvider(db, category, city);
    const { profile: providerB } = await createApprovedProvider(db, category, city);
    await db.insert(bookingQuotes).values({
      bookingId: booking.id,
      providerProfileId: providerA.id,
      amount: '100.00',
      status: 'accepted',
      respondedAt: new Date(),
    });

    const error = await expectPgError(() =>
      db.insert(bookingQuotes).values({
        bookingId: booking.id,
        providerProfileId: providerB.id,
        amount: '90.00',
        status: 'accepted',
        respondedAt: new Date(),
      }),
    );
    expect(error).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'booking_quotes_booking_accepted_uidx',
    });
  });

  it('different providers may each have a pending quote on the same booking', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile: providerA } = await createApprovedProvider(db, category, city);
    const { profile: providerB } = await createApprovedProvider(db, category, city);

    await db
      .insert(bookingQuotes)
      .values({ bookingId: booking.id, providerProfileId: providerA.id, amount: '100.00' });
    await db
      .insert(bookingQuotes)
      .values({ bookingId: booking.id, providerProfileId: providerB.id, amount: '120.00' });

    expect(await db.select().from(bookingQuotes)).toHaveLength(2);
  });
});

describe('booking_provider_releases', () => {
  it('records a release', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);

    const release = only(
      await db
        .insert(bookingProviderReleases)
        .values({
          bookingId: booking.id,
          providerProfileId: profile.id,
          reason: 'Vehicle broke down.',
          releasedAt: new Date(),
        })
        .returning(),
    );
    expect(release.reason).toBe('Vehicle broke down.');
  });

  it('allows no reason', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);

    const release = only(
      await db
        .insert(bookingProviderReleases)
        .values({ bookingId: booking.id, providerProfileId: profile.id, releasedAt: new Date() })
        .returning(),
    );
    expect(release.reason).toBeNull();
  });

  it('rejects a blank reason', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);

    const error = await expectPgError(() =>
      db.insert(bookingProviderReleases).values({
        bookingId: booking.id,
        providerProfileId: profile.id,
        reason: '   ',
        releasedAt: new Date(),
      }),
    );
    expect(error.constraint).toBe('booking_provider_releases_reason_valid');
  });

  it('allows several releases for the same booking (it can be released more than once)', async () => {
    const booking = await createBooking(db, customer, category, city);
    const { profile } = await createApprovedProvider(db, category, city);

    await db
      .insert(bookingProviderReleases)
      .values({ bookingId: booking.id, providerProfileId: profile.id, releasedAt: new Date() });
    await db
      .insert(bookingProviderReleases)
      .values({ bookingId: booking.id, providerProfileId: profile.id, releasedAt: new Date() });

    expect(await db.select().from(bookingProviderReleases)).toHaveLength(2);
  });
});
