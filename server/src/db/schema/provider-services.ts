import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { providerServiceStatus } from './enums.js';
import { providerProfiles } from './provider-profiles.js';
import { serviceCategories } from './service-categories.js';

/**
 * A provider offering one service category, and whether an admin has approved
 * them for it. This is the many-to-many link between providers and categories
 * and it carries the approval state, so eligibility is decided independently
 * for every category: being approved for plumbing says nothing about
 * electrical work.
 *
 * Only `approved` rows may ever be used for matching. That rule is enforced by
 * the application; this table guarantees the data to enforce it with.
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
    status: providerServiceStatus().notNull().default('pending'),
    /** When the current status was last decided by a reviewer. */
    reviewedAt: timestamp({ withTimezone: true }),
    /** Reviewer's reason, e.g. for a rejection or suspension. */
    reviewNote: text(),
    ...timestamps,
  },
  (t) => [
    // A provider applies to a category once. Its leading column also serves
    // lookups by provider_profile_id (the foreign key).
    uniqueIndex('provider_services_provider_category_uidx').on(
      t.providerProfileId,
      t.serviceCategoryId,
    ),
    // "Providers for category X in status Y": the matching lookup.
    index('provider_services_category_status_idx').on(t.serviceCategoryId, t.status),
    // Any decision (anything but pending) must record when it was made.
    check(
      'provider_services_decision_has_timestamp',
      sql`${t.status} = 'pending' or ${t.reviewedAt} is not null`,
    ),
  ],
);

export type ProviderService = typeof providerServices.$inferSelect;
export type NewProviderService = typeof providerServices.$inferInsert;
