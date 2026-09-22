import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { cities } from './cities.js';
import { timestamps } from './columns.js';
import { providerServiceStatus } from './enums.js';
import { providerProfiles } from './provider-profiles.js';
import { serviceCategories } from './service-categories.js';

/**
 * A provider offering one service category in one city, and whether a reviewer
 * has approved them for it. This is the link between providers and categories
 * and it carries the approval state, so eligibility is decided independently
 * for every category (and city): being approved for plumbing says nothing about
 * electrical work, and approval in one city says nothing about another.
 *
 * Only `approved` rows of a verified provider may ever be used for matching or
 * booking. The single query that applies that rule lives in the providers
 * module; this table guarantees the data to enforce it with.
 */
export const providerServices = pgTable(
  'provider_services',
  {
    id: uuid().primaryKey().defaultRandom(),
    providerProfileId: uuid()
      .notNull()
      .references(() => providerProfiles.id, { onDelete: 'restrict' }),
    serviceCategoryId: uuid()
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'restrict' }),
    cityId: uuid()
      .notNull()
      .references(() => cities.id, { onDelete: 'restrict' }),
    status: providerServiceStatus().notNull().default('pending'),
    /** When the current status was last decided by a reviewer. */
    reviewedAt: timestamp({ withTimezone: true }),
    /** Reviewer's reason, e.g. for a rejection or suspension. Shown to the provider. */
    reviewNote: text(),
    ...timestamps,
  },
  (t) => [
    // A provider applies for a category in a city once. Its leading column also
    // serves lookups by provider_profile_id (the foreign key).
    uniqueIndex('provider_services_provider_category_city_uidx').on(
      t.providerProfileId,
      t.serviceCategoryId,
      t.cityId,
    ),
    // "Providers for category X in city Y with status Z": the matching lookup.
    // Its leading column also serves the city foreign key.
    index('provider_services_city_category_status_idx').on(t.cityId, t.serviceCategoryId, t.status),
    // Serves the service_category_id foreign key.
    index('provider_services_category_idx').on(t.serviceCategoryId),
    // Any decision (anything but pending) must record when it was made.
    check(
      'provider_services_decision_has_timestamp',
      sql`${t.status} = 'pending' or ${t.reviewedAt} is not null`,
    ),
  ],
);

export type ProviderService = typeof providerServices.$inferSelect;
export type NewProviderService = typeof providerServices.$inferInsert;
