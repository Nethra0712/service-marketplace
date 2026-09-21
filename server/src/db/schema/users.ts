import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { userStatus } from './enums.js';

/**
 * One row per person, whatever role(s) they play. There is deliberately no
 * separate customer or provider user table: a user is a customer by default
 * and becomes a provider when a `provider_profiles` row exists for them.
 *
 * Identity is the phone number (OTP login comes in a later sprint). Users are
 * soft-deleted so financial and audit history can keep referencing them; the
 * account-deletion procedure will scrub personal data in place later.
 */
export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** International format, e.g. +94771234567. */
    phoneE164: text('phone_e164').notNull(),
    status: userStatus().notNull().default('active'),
    ...timestamps,
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('users_phone_e164_format', sql`${t.phoneE164} ~ '^[+][1-9][0-9]{6,14}$'`),
    // Unique among live accounts only, so a deleted account does not block
    // its phone number from ever registering again.
    uniqueIndex('users_phone_e164_active_uidx')
      .on(t.phoneE164)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
