import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { users } from './users.js';

/** Why a session was ended by the system rather than simply expiring. */
export const sessionRevokeReason = pgEnum('session_revoke_reason', [
  'logout',
  'refresh_token_reuse',
]);

export type SessionRevokeReason = (typeof sessionRevokeReason.enumValues)[number];

/**
 * One row per signed-in device/login. Access tokens carry the session id, and
 * the API checks it on every request, so revoking a session takes effect
 * immediately instead of when the access token happens to expire.
 *
 * Roles are deliberately not part of a session: the same session serves a user
 * acting as a customer or as a provider.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Absolute end of the session, however actively it is used. */
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    revokedReason: sessionRevokeReason(),
    ...timestamps,
  },
  (t) => [
    // Serves the user_id foreign key and "all sessions of this user".
    index('auth_sessions_user_id_idx').on(t.userId),
    index('auth_sessions_expires_at_idx').on(t.expiresAt),
    // A revocation always records why, and a reason never exists without one.
    check(
      'auth_sessions_revocation_consistent',
      sql`(${t.revokedAt} is null) = (${t.revokedReason} is null)`,
    ),
    check('auth_sessions_expiry_after_creation', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
