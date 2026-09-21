import { timestamp } from 'drizzle-orm/pg-core';

/**
 * Shared audit timestamps. `updated_at` is maintained by a database trigger
 * (see the `updated_at_triggers` migration), so it stays correct even for
 * updates that bypass the application.
 */
export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};
