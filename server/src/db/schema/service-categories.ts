import { sql } from 'drizzle-orm';
import { boolean, check, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { pricingModel } from './enums.js';

/**
 * A kind of service customers can request (plumbing, cleaning, ...).
 * Categories are data, not code: adding one is an insert, never a deploy.
 *
 * Not modelled here on purpose: translated names (a later translations
 * table) and commission (that is platform-wide configuration, not
 * per-category — see the `payments` module).
 */
export const serviceCategories = pgTable(
  'service_categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Stable lowercase identifier for URLs and code, e.g. `ac-repair`. */
    slug: text().notNull(),
    /** Canonical display name (English). */
    name: text().notNull(),
    description: text(),
    pricingModel: pricingModel().notNull(),
    /**
     * LKR per job (`fixed`) or per hour (`hourly`). Required for those two
     * pricing models and forbidden for `quote`, where the price only ever
     * comes from a provider's own quote. This is the rate a booking's
     * `agreed_amount` is derived from once a provider is assigned.
     */
    baseRate: numeric({ precision: 12, scale: 2 }),
    /** Inactive categories are hidden from new requests but keep their history. */
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('service_categories_slug_uidx').on(t.slug),
    check('service_categories_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('service_categories_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('service_categories_base_rate_positive', sql`${t.baseRate} is null or ${t.baseRate} > 0`),
    check(
      'service_categories_base_rate_matches_pricing_model',
      sql`(${t.pricingModel} = 'quote') = (${t.baseRate} is null)`,
    ),
  ],
);

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type NewServiceCategory = typeof serviceCategories.$inferInsert;
