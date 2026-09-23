import { sql } from 'drizzle-orm';
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { bookings } from './bookings.js';
import { timestamps } from './columns.js';
import { bookingQuoteStatus } from './enums.js';
import { providerProfiles } from './provider-profiles.js';

/**
 * One provider's proposed price for a quote-priced booking. The customer
 * accepts at most one; accepting it assigns that provider to the booking (see
 * `bookings.service.ts`). A provider whose quote was rejected may quote again
 * (the "one active quote" rule only blocks a second *pending or accepted* row),
 * mirroring how a rejected provider application can be re-opened.
 */
export const bookingQuotes = pgTable(
  'booking_quotes',
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    providerProfileId: uuid()
      .notNull()
      .references(() => providerProfiles.id, { onDelete: 'restrict' }),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    note: text(),
    status: bookingQuoteStatus().notNull().default('pending'),
    /** When the customer accepted or rejected it. */
    respondedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // One active (not-yet-rejected) quote per provider per booking. Also serves
    // "all quotes on this booking", the common lookup.
    uniqueIndex('booking_quotes_booking_provider_active_uidx')
      .on(t.bookingId, t.providerProfileId)
      .where(sql`${t.status} <> 'rejected'`),
    // At most one accepted quote per booking: this is what lets the accepted
    // quote be looked up unambiguously instead of stored redundantly on the booking.
    uniqueIndex('booking_quotes_booking_accepted_uidx')
      .on(t.bookingId)
      .where(sql`${t.status} = 'accepted'`),
    // Serves the provider_profile_id foreign key and "my quotes".
    index('booking_quotes_provider_idx').on(t.providerProfileId),

    check('booking_quotes_amount_positive', sql`${t.amount} > 0`),
    check(
      'booking_quotes_note_valid',
      sql`${t.note} is null or (btrim(${t.note}) <> '' and char_length(${t.note}) <= 500)`,
    ),
    check(
      'booking_quotes_responded_at_matches_status',
      sql`(${t.status} = 'pending') = (${t.respondedAt} is null)`,
    ),
  ],
);

export type BookingQuote = typeof bookingQuotes.$inferSelect;
export type NewBookingQuote = typeof bookingQuotes.$inferInsert;
