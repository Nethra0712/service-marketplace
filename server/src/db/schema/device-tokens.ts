import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { devicePlatform } from './enums.js';
import { users } from './users.js';

/**
 * One push token for one installed app instance. The token itself (not the
 * user) is unique: it identifies a specific device install, so registering a
 * token already on file just reassigns it (a token refresh, or the same
 * device signing in as someone else) rather than creating a duplicate row —
 * see `notifications.repository.ts`'s `upsertToken`.
 */
export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    token: text().notNull(),
    platform: devicePlatform().notNull(),
    ...timestamps,
  },
  (t) => [
    index('device_tokens_user_idx').on(t.userId),
    uniqueIndex('device_tokens_token_uidx').on(t.token),
    check('device_tokens_token_not_blank', sql`btrim(${t.token}) <> ''`),
  ],
);

export type DeviceToken = typeof deviceTokens.$inferSelect;
export type NewDeviceToken = typeof deviceTokens.$inferInsert;
