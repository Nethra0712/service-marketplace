import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { bookings } from './bookings.js';
import { providerProfiles } from './provider-profiles.js';

/**
 * A record of a provider cancelling an assignment after accepting it. The
 * booking itself returns to `searching` rather than ending (see
 * `bookings.status`); this table is the only place the release itself is kept,
 * so Sprint 6's re-dispatch can see a booking's release history (for example,
 * to avoid immediately re-offering it to the same provider).
 */
export const bookingProviderReleases = pgTable(
  'booking_provider_releases',
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    providerProfileId: uuid()
      .notNull()
      .references(() => providerProfiles.id, { onDelete: 'restrict' }),
    reason: text(),
    releasedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    index('booking_provider_releases_booking_idx').on(t.bookingId),
    index('booking_provider_releases_provider_idx').on(t.providerProfileId),
    check(
      'booking_provider_releases_reason_valid',
      sql`${t.reason} is null or (btrim(${t.reason}) <> '' and char_length(${t.reason}) <= 500)`,
    ),
  ],
);

export type BookingProviderRelease = typeof bookingProviderReleases.$inferSelect;
export type NewBookingProviderRelease = typeof bookingProviderReleases.$inferInsert;
