import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { authSessions } from './auth-sessions.js';
import { timestamps } from './columns.js';

/**
 * Every refresh token ever issued for a session. Tokens are single-use: each
 * refresh marks the presented token as used and issues a new one. The full
 * lineage is kept until expiry so that presenting an already-used token can be
 * recognised as theft or replay and the whole session revoked.
 *
 * Only a SHA-256 hash is stored. Refresh tokens are 256-bit random values, so
 * a fast hash is sufficient; the raw token exists only on the client.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid()
      .notNull()
      .references(() => authSessions.id, { onDelete: 'restrict' }),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Set when this token was exchanged for a new one. Presenting it again is reuse. */
    usedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // The lookup key on every refresh.
    uniqueIndex('refresh_tokens_token_hash_uidx').on(t.tokenHash),
    index('refresh_tokens_session_id_idx').on(t.sessionId),
    index('refresh_tokens_expires_at_idx').on(t.expiresAt),
    check('refresh_tokens_token_hash_format', sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check('refresh_tokens_expiry_after_creation', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
