import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { pricingModel } from './enums.js';

/**
 * A kind of service customers can request (plumbing, cleaning, ...).
 * Categories are data, not code: adding one is an insert, never a deploy.
 *
 * Not modelled here on purpose: translated names (a later translations
 * table), and rates or commission (they belong to pricing configuration).
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
    /** Inactive categories are hidden from new requests but keep their history. */
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('service_categories_slug_uidx').on(t.slug),
    check('service_categories_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('service_categories_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type NewServiceCategory = typeof serviceCategories.$inferInsert;
