import { sql } from 'drizzle-orm';
import { check, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { appLanguage } from './enums.js';
import { serviceCategories } from './service-categories.js';

/**
 * A category's name and description in one language. The English text lives on
 * the category itself and is the fallback, so a missing translation never
 * leaves a blank in the app.
 */
export const serviceCategoryTranslations = pgTable(
  'service_category_translations',
  {
    id: uuid().primaryKey().defaultRandom(),
    serviceCategoryId: uuid()
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'restrict' }),
    language: appLanguage().notNull(),
    name: text().notNull(),
    description: text(),
    ...timestamps,
  },
  (t) => [
    // One translation per category and language; also indexes the category FK.
    uniqueIndex('service_category_translations_category_language_uidx').on(
      t.serviceCategoryId,
      t.language,
    ),
    check('service_category_translations_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

export type ServiceCategoryTranslation = typeof serviceCategoryTranslations.$inferSelect;
export type NewServiceCategoryTranslation = typeof serviceCategoryTranslations.$inferInsert;
