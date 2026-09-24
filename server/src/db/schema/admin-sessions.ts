import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { adminUsers } from './admin-users.js';
import { timestamps } from './columns.js';

/**
 * One row per admin login, the same role `auth_sessions` plays for the
 * mobile app: the session cookie's JWT carries this id, and every admin
 * request re-checks the row here, so revoking a session (logout) takes
 * effect immediately instead of when the token happens to expire.
 */
export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    adminUserId: uuid()
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'restrict' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('admin_sessions_admin_user_id_idx').on(t.adminUserId)],
);

export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;
