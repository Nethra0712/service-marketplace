import { sql } from 'drizzle-orm';
import { check, index, pgTable, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { bookings } from './bookings.js';
import { timestamps } from './columns.js';
import { users } from './users.js';

/**
 * One participant's rating of the other, for one completed booking.
 * `target_user_id` is always the OTHER participant — never the author — so a
 * provider's aggregate rating (`reviews.service.ts`'s
 * `getProviderRatingSummary`) is a plain `avg(rating) where target_user_id =
 * ...`, safe from a user ever rating themselves or submitting an aggregate
 * directly.
 *
 * Two-sided: the customer may review the provider and the provider may
 * review the customer, independently. The unique index is what makes "one
 * review per participant per booking" a database guarantee rather than an
 * application-level check.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    authorUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    targetUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    rating: smallint().notNull(),
    comment: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('reviews_booking_author_uidx').on(t.bookingId, t.authorUserId),
    // A provider's (or customer's) aggregate rating and received-reviews list.
    index('reviews_target_created_idx').on(t.targetUserId, t.createdAt),
    index('reviews_booking_idx').on(t.bookingId),
    check('reviews_rating_range', sql`${t.rating} between 1 and 5`),
    check(
      'reviews_comment_valid',
      sql`${t.comment} is null or (btrim(${t.comment}) <> '' and char_length(${t.comment}) <= 1000)`,
    ),
    check('reviews_author_not_target', sql`${t.authorUserId} <> ${t.targetUserId}`),
  ],
);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
