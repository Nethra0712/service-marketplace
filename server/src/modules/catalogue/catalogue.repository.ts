import { and, asc, eq, exists, ilike, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Queryable } from '../../db/client.js';
import {
  cities,
  cityCategories,
  serviceCategories,
  serviceCategoryTranslations,
  type AppLanguage,
  type PricingModel,
} from '../../db/schema/index.js';

export interface CategoryFilter {
  /** Language for names and descriptions. Missing translations fall back to English. */
  language: AppLanguage;
  /** Free-text search over names, descriptions and slugs, in every language. */
  search?: string | undefined;
  pricingModel?: PricingModel | undefined;
  /** Only categories offered in this city. */
  citySlug?: string | undefined;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  pricingModel: PricingModel;
}

export interface CityRow {
  id: string;
  slug: string;
  name: string;
  countryCode: string;
  timezone: string;
  currency: string;
}

/** Escapes LIKE wildcards so user input is matched literally. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * All catalogue reads. Every query here enforces the same visibility rule: a
 * category is customer-visible only if it is active AND offered (active) in at
 * least one active city. Nothing outside this file decides what is visible.
 */
export function createCatalogueRepository(db: Queryable) {
  function visibleCategory(citySlug: string | undefined) {
    return and(
      eq(serviceCategories.isActive, true),
      exists(
        db
          .select({ one: sql`1` })
          .from(cityCategories)
          .innerJoin(cities, eq(cities.id, cityCategories.cityId))
          .where(
            and(
              eq(cityCategories.serviceCategoryId, serviceCategories.id),
              eq(cityCategories.isActive, true),
              eq(cities.isActive, true),
              citySlug === undefined ? undefined : eq(cities.slug, citySlug),
            ),
          ),
      ),
    );
  }

  const localizedName = sql<string>`coalesce(${serviceCategoryTranslations.name}, ${serviceCategories.name})`;
  const localizedDescription = sql<
    string | null
  >`coalesce(${serviceCategoryTranslations.description}, ${serviceCategories.description})`;

  function selectCategories(language: AppLanguage) {
    return db
      .select({
        id: serviceCategories.id,
        slug: serviceCategories.slug,
        name: localizedName,
        description: localizedDescription,
        pricingModel: serviceCategories.pricingModel,
      })
      .from(serviceCategories)
      .leftJoin(
        serviceCategoryTranslations,
        and(
          eq(serviceCategoryTranslations.serviceCategoryId, serviceCategories.id),
          eq(serviceCategoryTranslations.language, language),
        ),
      );
  }

  return {
    async listCities(): Promise<CityRow[]> {
      return db
        .select({
          id: cities.id,
          slug: cities.slug,
          name: cities.name,
          countryCode: cities.countryCode,
          timezone: cities.timezone,
          currency: cities.currency,
        })
        .from(cities)
        .where(eq(cities.isActive, true))
        .orderBy(asc(cities.name));
    },

    async listCategories(filter: CategoryFilter): Promise<CategoryRow[]> {
      const like = filter.search ? `%${escapeLike(filter.search)}%` : undefined;
      const searchTranslation = alias(serviceCategoryTranslations, 'search_translation');

      return selectCategories(filter.language)
        .where(
          and(
            visibleCategory(filter.citySlug),
            filter.pricingModel
              ? eq(serviceCategories.pricingModel, filter.pricingModel)
              : undefined,
            like
              ? or(
                  ilike(serviceCategories.name, like),
                  ilike(serviceCategories.slug, like),
                  ilike(serviceCategories.description, like),
                  // A translation in ANY language matches, so a Sinhala search finds
                  // the category even when the screen is in English.
                  exists(
                    db
                      .select({ one: sql`1` })
                      .from(searchTranslation)
                      .where(
                        and(
                          eq(searchTranslation.serviceCategoryId, serviceCategories.id),
                          or(
                            ilike(searchTranslation.name, like),
                            ilike(searchTranslation.description, like),
                          ),
                        ),
                      ),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(asc(localizedName), asc(serviceCategories.slug));
    },

    /** A visible category by slug, or undefined (inactive and hidden ones look identical to missing ones). */
    async findCategory(slug: string, language: AppLanguage): Promise<CategoryRow | undefined> {
      const [row] = await selectCategories(language).where(
        and(eq(serviceCategories.slug, slug), visibleCategory(undefined)),
      );
      return row;
    },

    /** Active cities that currently offer the category. */
    async listCitiesOffering(categoryId: string): Promise<CityRow[]> {
      return db
        .select({
          id: cities.id,
          slug: cities.slug,
          name: cities.name,
          countryCode: cities.countryCode,
          timezone: cities.timezone,
          currency: cities.currency,
        })
        .from(cityCategories)
        .innerJoin(cities, eq(cities.id, cityCategories.cityId))
        .where(
          and(
            eq(cityCategories.serviceCategoryId, categoryId),
            eq(cityCategories.isActive, true),
            eq(cities.isActive, true),
          ),
        )
        .orderBy(asc(cities.name));
    },
  };
}

export type CatalogueRepository = ReturnType<typeof createCatalogueRepository>;
