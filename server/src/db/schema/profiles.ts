import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { appLanguage } from './enums.js';
import { users } from './users.js';

/**
 * Personal details shared by every role. Split from `users` so identity
 * (phone, account state) stays small and stable while profile data can evolve.
 * The row is created when the person first provides details, so it may not
 * exist yet for a brand-new account.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    fullName: text(),
    preferredLanguage: appLanguage().notNull().default('en'),
    ...timestamps,
  },
  (t) => [
    // One profile per user; also serves as the index for the user_id foreign key.
    uniqueIndex('profiles_user_id_uidx').on(t.userId),
    check('profiles_full_name_not_blank', sql`${t.fullName} is null or btrim(${t.fullName}) <> ''`),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
