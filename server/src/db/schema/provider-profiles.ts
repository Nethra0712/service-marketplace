import { sql } from 'drizzle-orm';
import {
  check,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { providerAvailability, providerVerificationStatus } from './enums.js';
import { users } from './users.js';

/**
 * Provider-specific data for a user who offers services. Its existence is
 * what makes a user a provider. Which categories the provider may actually
 * serve is decided per category in `provider_services`, never here.
 *
 * The provider's name is not stored here: it is the user's `profiles.full_name`,
 * shared with the customer side of the same account.
 */
export const providerProfiles = pgTable(
  'provider_profiles',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Free-text introduction shown to customers. */
    bio: text(),
    yearsOfExperience: smallint(),
    /**
     * draft -> submitted (by the provider) -> verified | rejected (by a
     * reviewer, never through the public API). A rejected provider can edit and
     * submit again.
     */
    verificationStatus: providerVerificationStatus().notNull().default('draft'),
    submittedAt: timestamp({ withTimezone: true }),
    /** When a reviewer last decided (verified or rejected). */
    reviewedAt: timestamp({ withTimezone: true }),
    /** Reviewer's reason, e.g. for a rejection. Shown to the provider. */
    reviewNote: text(),
    /**
     * The provider's own online/offline toggle. Only the persisted intent lives
     * here; live presence and location are handled elsewhere in a later sprint.
     */
    availability: providerAvailability().notNull().default('offline'),
    /**
     * The provider's most recently reported location, used as a matching
     * input (distance ranking). A snapshot, not a track: it is overwritten in
     * place and never logged, so there is no location history to build a
     * continuous tracking feature from later.
     */
    lastLatitude: numeric({ precision: 9, scale: 6 }),
    lastLongitude: numeric({ precision: 9, scale: 6 }),
    lastLocationAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // At most one provider profile per user; also indexes the user_id foreign key.
    uniqueIndex('provider_profiles_user_id_uidx').on(t.userId),
    check(
      'provider_profiles_bio_valid',
      sql`${t.bio} is null or (btrim(${t.bio}) <> '' and char_length(${t.bio}) <= 1000)`,
    ),
    check(
      'provider_profiles_experience_range',
      sql`${t.yearsOfExperience} is null or (${t.yearsOfExperience} between 0 and 60)`,
    ),
    check(
      'provider_profiles_location_pair',
      sql`(${t.lastLatitude} is null) = (${t.lastLongitude} is null) and (${t.lastLatitude} is null) = (${t.lastLocationAt} is null)`,
    ),
    check(
      'provider_profiles_location_range',
      sql`${t.lastLatitude} is null or (${t.lastLatitude} between -90 and 90 and ${t.lastLongitude} between -180 and 180)`,
    ),
    // Anything past draft has been submitted, so it must say when.
    check(
      'provider_profiles_submitted_has_timestamp',
      sql`${t.verificationStatus} = 'draft' or ${t.submittedAt} is not null`,
    ),
    // A decision must record when it was made.
    check(
      'provider_profiles_decision_has_timestamp',
      sql`${t.verificationStatus} not in ('verified', 'rejected') or ${t.reviewedAt} is not null`,
    ),
  ],
);

export type ProviderProfile = typeof providerProfiles.$inferSelect;
export type NewProviderProfile = typeof providerProfiles.$inferInsert;
