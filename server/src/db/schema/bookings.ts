import { sql } from 'drizzle-orm';
import { check, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { cities } from './cities.js';
import { timestamps } from './columns.js';
import { bookingStatus, bookingType, pricingModel } from './enums.js';
import { providerProfiles } from './provider-profiles.js';
import { serviceCategories } from './service-categories.js';
import { users } from './users.js';

/** Stages that keep the booking assigned to `provider_profile_id`. */
const ASSIGNED_STATUSES = sql`('accepted', 'en_route', 'arrived', 'in_progress', 'completed')`;

/**
 * One customer's request for a service, from creation through completion or
 * cancellation. `pricing_model` is copied from the category at creation time:
 * the booking must stay internally consistent even if the category's pricing
 * model changes later.
 *
 * No automatic matching yet (Sprint 6): a provider becomes assigned either by
 * directly accepting an open request (fixed/hourly) or by the customer
 * accepting their quote (quote-priced, see `booking_quotes`). Provider
 * cancellation after acceptance returns the booking to `searching` instead of
 * ending it — see `booking_provider_releases` — so Sprint 6's re-dispatch has
 * somewhere to pick it back up.
 */
export const bookings = pgTable(
  'bookings',
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    serviceCategoryId: uuid()
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'restrict' }),
    /** Set once a provider is assigned; cleared again if they release the job. */
    providerProfileId: uuid().references(() => providerProfiles.id, { onDelete: 'restrict' }),
    cityId: uuid()
      .notNull()
      .references(() => cities.id, { onDelete: 'restrict' }),
    bookingType: bookingType().notNull(),
    status: bookingStatus().notNull().default('searching'),
    pricingModel: pricingModel().notNull(),
    /** Required for `scheduled`, forbidden for `on_demand`. */
    scheduledAt: timestamp({ withTimezone: true }),
    customerNotes: text(),
    serviceAddress: text().notNull(),
    /** Set once agreed: from an accepted quote today; a fixed/hourly rate later. */
    agreedAmount: numeric({ precision: 12, scale: 2 }),
    acceptedAt: timestamp({ withTimezone: true }),
    enRouteAt: timestamp({ withTimezone: true }),
    arrivedAt: timestamp({ withTimezone: true }),
    workStartedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    /** Set only by a customer cancellation; a provider release keeps the booking open. */
    cancelledAt: timestamp({ withTimezone: true }),
    cancelledByUserId: uuid().references(() => users.id, { onDelete: 'restrict' }),
    cancellationReason: text(),
    ...timestamps,
  },
  (t) => [
    // "My bookings", newest first, optionally by status. Also serves the FK.
    index('bookings_customer_idx').on(t.customerId, t.status, t.createdAt),
    // "Bookings assigned to me". Also serves the FK.
    index('bookings_provider_idx').on(t.providerProfileId, t.status, t.createdAt),
    // "Open requests I could accept or quote on", scoped to one category/city.
    index('bookings_open_category_city_idx')
      .on(t.serviceCategoryId, t.cityId, t.createdAt)
      .where(sql`${t.status} = 'searching'`),
    index('bookings_category_idx').on(t.serviceCategoryId),
    index('bookings_city_idx').on(t.cityId),
    index('bookings_cancelled_by_user_idx').on(t.cancelledByUserId),

    check(
      'bookings_scheduled_at_matches_type',
      sql`(${t.bookingType} = 'scheduled' and ${t.scheduledAt} is not null) or
          (${t.bookingType} = 'on_demand' and ${t.scheduledAt} is null)`,
    ),
    check(
      'bookings_service_address_valid',
      sql`btrim(${t.serviceAddress}) <> '' and char_length(${t.serviceAddress}) <= 500`,
    ),
    check(
      'bookings_customer_notes_valid',
      sql`${t.customerNotes} is null or
          (btrim(${t.customerNotes}) <> '' and char_length(${t.customerNotes}) <= 1000)`,
    ),
    check(
      'bookings_agreed_amount_positive',
      sql`${t.agreedAmount} is null or ${t.agreedAmount} > 0`,
    ),

    // A provider is assigned for exactly the statuses that need one.
    check(
      'bookings_provider_matches_status',
      sql`(${t.status} <> 'searching' or ${t.providerProfileId} is null) and
          (${t.status} not in ${ASSIGNED_STATUSES} or ${t.providerProfileId} is not null)`,
    ),
    // Each stage's timestamp is set from the moment the booking first reaches it
    // and is never cleared by moving further on, so "have we passed X" is one check.
    check(
      'bookings_accepted_at_progression',
      sql`${t.status} not in ${ASSIGNED_STATUSES} or ${t.acceptedAt} is not null`,
    ),
    check(
      'bookings_en_route_at_progression',
      sql`${t.status} not in ('en_route', 'arrived', 'in_progress', 'completed') or ${t.enRouteAt} is not null`,
    ),
    check(
      'bookings_arrived_at_progression',
      sql`${t.status} not in ('arrived', 'in_progress', 'completed') or ${t.arrivedAt} is not null`,
    ),
    check(
      'bookings_work_started_at_progression',
      sql`${t.status} not in ('in_progress', 'completed') or ${t.workStartedAt} is not null`,
    ),
    check(
      'bookings_completed_at_matches_status',
      sql`(${t.status} = 'completed') = (${t.completedAt} is not null)`,
    ),
    check(
      'bookings_cancellation_matches_status',
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} is not null) and
          (${t.cancelledAt} is null) = (${t.cancelledByUserId} is null)`,
    ),
    check(
      'bookings_cancellation_reason_valid',
      sql`${t.cancellationReason} is null or
          (btrim(${t.cancellationReason}) <> '' and char_length(${t.cancellationReason}) <= 500)`,
    ),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
