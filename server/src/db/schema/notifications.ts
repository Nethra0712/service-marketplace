import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { bookings } from './bookings.js';
import { timestamps } from './columns.js';
import { notificationKind } from './enums.js';
import { payments } from './payments.js';
import { providerPayouts } from './provider-payouts.js';
import { users } from './users.js';

/**
 * One durable, in-app record per notified event, so an important event is
 * never *only* an ephemeral push message (see the module doc comment). A
 * push message is sent alongside this row when the recipient allows push,
 * but this row exists regardless.
 *
 * `dedupe_key` makes "don't notify the same event twice" a database
 * guarantee rather than an application-level race: `notify()` inserts with
 * `ON CONFLICT (user_id, dedupe_key) DO NOTHING` and only sends a push when a
 * row was actually created. Its shape is `<kind>:<sourceId>`, e.g.
 * `booking_accepted:<bookingId>` or `payout_paid:<payoutId>` — unique enough
 * that the same source event can never double-insert for one recipient, even
 * across retries or concurrent requests.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    kind: notificationKind().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'restrict' }),
    paymentId: uuid().references(() => payments.id, { onDelete: 'restrict' }),
    payoutId: uuid().references(() => providerPayouts.id, { onDelete: 'restrict' }),
    readAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('notifications_user_dedupe_uidx').on(t.userId, t.dedupeKey),
    // "My notifications", newest first. Also serves the FK.
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    // Unread count/list, scoped to one user.
    index('notifications_user_unread_idx')
      .on(t.userId, t.createdAt)
      .where(sql`${t.readAt} is null`),
    index('notifications_booking_idx').on(t.bookingId),
    index('notifications_payment_idx').on(t.paymentId),
    index('notifications_payout_idx').on(t.payoutId),
    check(
      'notifications_title_valid',
      sql`btrim(${t.title}) <> '' and char_length(${t.title}) <= 200`,
    ),
    check(
      'notifications_body_valid',
      sql`btrim(${t.body}) <> '' and char_length(${t.body}) <= 1000`,
    ),
    check('notifications_dedupe_key_not_blank', sql`btrim(${t.dedupeKey}) <> ''`),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
