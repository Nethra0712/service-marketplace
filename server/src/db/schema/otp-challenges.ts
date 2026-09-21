import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';

/**
 * One row per OTP sent. The code itself is never stored, only a keyed hash
 * (HMAC-SHA-256 with a server secret), so a leaked table cannot be used to
 * recover codes by brute force. A challenge is usable exactly once, only until
 * it expires, and only for a limited number of guesses.
 *
 * Deliberately has no foreign key to `users`: a challenge is issued for a phone
 * number before any account exists.
 */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid().primaryKey().defaultRandom(),
    phoneE164: text('phone_e164').notNull(),
    codeHash: text().notNull(),
    /** Verification attempts consumed so far (counted before the code is compared). */
    attempts: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Set when the code was successfully used. A consumed challenge is dead. */
    consumedAt: timestamp({ withTimezone: true }),
    /** Set when a newer challenge for the same phone replaced this one. */
    invalidatedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Cooldown and hourly-cap lookups: newest challenges for a phone.
    index('otp_challenges_phone_created_idx').on(t.phoneE164, t.createdAt.desc()),
    // Cleanup of expired rows.
    index('otp_challenges_expires_at_idx').on(t.expiresAt),
    check('otp_challenges_phone_e164_format', sql`${t.phoneE164} ~ '^[+][1-9][0-9]{6,14}$'`),
    check('otp_challenges_code_hash_format', sql`${t.codeHash} ~ '^[0-9a-f]{64}$'`),
    check('otp_challenges_attempts_non_negative', sql`${t.attempts} >= 0`),
    check('otp_challenges_expiry_after_creation', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export type OtpChallenge = typeof otpChallenges.$inferSelect;
export type NewOtpChallenge = typeof otpChallenges.$inferInsert;
