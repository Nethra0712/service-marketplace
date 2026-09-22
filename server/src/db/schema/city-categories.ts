import { boolean, index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { cities } from './cities.js';
import { timestamps } from './columns.js';
import { serviceCategories } from './service-categories.js';

/**
 * Which service categories a city offers. A category is visible to customers
 * only where it is active AND enabled for at least one active city, and a
 * provider can apply for a category only in a city that offers it.
 */
export const cityCategories = pgTable(
  'city_categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    cityId: uuid()
      .notNull()
      .references(() => cities.id, { onDelete: 'restrict' }),
    serviceCategoryId: uuid()
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'restrict' }),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    // One row per city and category; its leading column also indexes the city FK.
    uniqueIndex('city_categories_city_category_uidx').on(t.cityId, t.serviceCategoryId),
    index('city_categories_category_idx').on(t.serviceCategoryId),
  ],
);

export type CityCategory = typeof cityCategories.$inferSelect;
export type NewCityCategory = typeof cityCategories.$inferInsert;
