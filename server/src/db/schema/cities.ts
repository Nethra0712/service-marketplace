import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';

/**
 * A place the marketplace operates in. Launch is Colombo only, but nothing in
 * the design assumes one city: a provider is approved for a category *in a
 * city*, and each city chooses which categories it offers.
 *
 * Deliberately no geometry yet. City boundaries (PostGIS polygons) arrive with
 * the work that needs them (serviceability checks, matching).
 */
export const cities = pgTable(
  'cities',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Stable lowercase identifier, e.g. `colombo`. */
    slug: text().notNull(),
    name: text().notNull(),
    /** ISO 3166-1 alpha-2, e.g. `LK`. */
    countryCode: text().notNull(),
    /** IANA time zone, e.g. `Asia/Colombo`. */
    timezone: text().notNull(),
    /** ISO 4217, e.g. `LKR`. Prices in this city are in this currency. */
    currency: text().notNull(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('cities_slug_uidx').on(t.slug),
    check('cities_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('cities_country_code_format', sql`${t.countryCode} ~ '^[A-Z]{2}$'`),
    check('cities_currency_format', sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check('cities_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('cities_timezone_not_blank', sql`btrim(${t.timezone}) <> ''`),
  ],
);

export type City = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;
