import { boolean, pgTable, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { users } from './users.js';

/**
 * One row per user, created lazily the first time they change a default.
 * Absence of a row means every default applies — see
 * `notifications.repository.ts`'s `getPreferences`. Kept deliberately small
 * (a single global push toggle) rather than per-event-kind granularity,
 * which can be added here later without touching anything else.
 */
export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'restrict' }),
  pushEnabled: boolean().notNull().default(true),
  ...timestamps,
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
