import { sql } from 'drizzle-orm';
import {
  check,
  index,
  numeric,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { bookings } from './bookings.js';
import { timestamps } from './columns.js';
import { bookingOfferStatus } from './enums.js';
import { providerProfiles } from './provider-profiles.js';

/**
 * One provider's dispatch offer for a booking, created by automatic matching
 * (see `matching` module) rather than chosen by the provider. A provider can
 * be offered the same booking more than once across separate waves if they
 * lost an earlier wave's race (`superseded` — someone else won before they
 * got an answer window at all) — but never twice within the same wave, and
 * never while a prior offer of theirs on this booking is still `pending`.
 * Anyone who explicitly `declined`, let an offer lapse unanswered
 * (`expired`), or accepted and later released the job (see
 * `booking_provider_releases`), is excluded from every later wave; see
 * `bookings.repository.ts#listExcludedProviderIds`.
 *
 * `booking_offers_booking_accepted_uidx` is the row that actually prevents two
 * providers from both winning the same booking: only one row per booking can
 * ever hold `status = 'accepted'`, so the transaction that flips a pending
 * offer to accepted is the same transaction that wins the booking, and a
 * concurrent competing transaction fails the unique constraint (or finds the
 * row already gone) rather than racing to a bad outcome.
 */
export const bookingOffers = pgTable(
  'booking_offers',
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    providerProfileId: uuid()
      .notNull()
      .references(() => providerProfiles.id, { onDelete: 'restrict' }),
    /** 1-based dispatch wave this offer was created in. Descriptive, not a key. */
    wave: smallint().notNull(),
    status: bookingOfferStatus().notNull().default('pending'),
    offeredAt: timestamp({ withTimezone: true }).notNull(),
    /** This offer lapses (becomes `expired`) if not answered by this time. */
    respondsBy: timestamp({ withTimezone: true }).notNull(),
    /** When the provider accepted/declined, or the offer was superseded/expired. */
    respondedAt: timestamp({ withTimezone: true }),
    /** Distance snapshot at offer time (km), for the provider's UI and audit. Null if either side's location was unknown. */
    distanceKm: numeric({ precision: 8, scale: 2 }),
    ...timestamps,
  },
  (t) => [
    // A provider is offered a booking at most once per wave.
    uniqueIndex('booking_offers_booking_provider_wave_uidx').on(
      t.bookingId,
      t.providerProfileId,
      t.wave,
    ),
    // ...and never holds two simultaneously-live offers on the same booking.
    uniqueIndex('booking_offers_booking_provider_pending_uidx')
      .on(t.bookingId, t.providerProfileId)
      .where(sql`${t.status} = 'pending'`),
    // At most one accepted offer per booking: the concurrency guarantee.
    uniqueIndex('booking_offers_booking_accepted_uidx')
      .on(t.bookingId)
      .where(sql`${t.status} = 'accepted'`),
    // "This booking's current wave" / "has anyone been offered this booking".
    index('booking_offers_booking_status_idx').on(t.bookingId, t.status),
    // "My pending offers" / serves the provider_profile_id foreign key.
    index('booking_offers_provider_status_idx').on(t.providerProfileId, t.status),

    check('booking_offers_wave_positive', sql`${t.wave} > 0`),
    check(
      'booking_offers_responded_at_matches_status',
      sql`(${t.status} = 'pending') = (${t.respondedAt} is null)`,
    ),
    check('booking_offers_responds_by_after_offered', sql`${t.respondsBy} > ${t.offeredAt}`),
    check(
      'booking_offers_distance_non_negative',
      sql`${t.distanceKm} is null or ${t.distanceKm} >= 0`,
    ),
  ],
);

export type BookingOffer = typeof bookingOffers.$inferSelect;
export type NewBookingOffer = typeof bookingOffers.$inferInsert;
