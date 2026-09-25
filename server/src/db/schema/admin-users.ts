import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';

/**
 * Internal staff, not marketplace participants: deliberately a separate
 * table from `users` rather than a role flag on it, since an admin never
 * customer/provider-facing (no phone/OTP identity, no booking history) and
 * `users` stays "who is on the marketplace". There is a single admin role in
 * V1 — every row here has full admin access; a `role` column narrowing that
 * is a later, additive change if it is ever needed.
 *
 * Created only by the `npm run dev:create-admin` script — there is
 * deliberately no self-registration endpoint (see `admin-auth.routes.ts`).
 */
export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    fullName: text().notNull(),
    /** Consecutive failed logins since the last success. Reset to 0 on a successful login. */
    failedLoginAttempts: integer().notNull().default(0),
    /** Set once `failedLoginAttempts` crosses the lockout threshold; login is refused (with the same generic error as a wrong password) until this passes. */
    lockedUntil: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('admin_users_email_uidx').on(t.email),
    check('admin_users_email_format', sql`${t.email} ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`),
    check('admin_users_full_name_not_blank', sql`btrim(${t.fullName}) <> ''`),
    check('admin_users_failed_login_attempts_non_negative', sql`${t.failedLoginAttempts} >= 0`),
  ],
);

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
