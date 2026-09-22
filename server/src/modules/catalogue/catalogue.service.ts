import type { PricingModel } from '../../db/schema/index.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import type { CategoryFilter, CatalogueRepository, CityRow } from './catalogue.repository.js';

export interface CityView {
  slug: string;
  name: string;
  countryCode: string;
  timezone: string;
  currency: string;
}

export interface CategoryView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  pricingModel: PricingModel;
}

export interface CategoryDetailView extends CategoryView {
  /** Active cities where this category is offered. */
  cities: CityView[];
  /** Providers a customer could actually be matched with right now. */
  availableProviderCount: number;
}

/**
 * How many providers can currently be booked for a category. The key is
 * `serviceCategoryId`, the same name the providers module filters on: an
 * unknown key would be silently ignored and count every category.
 */
export type BookableProviderCounter = (filter: {
  serviceCategoryId: string;
  citySlug?: string;
}) => Promise<number>;

export interface CatalogueServiceDeps {
  repository: CatalogueRepository;
  /**
   * Counts providers who are approved, verified and active for a category. Supplied
   * by the providers module: it alone decides who counts as bookable.
   */
  countBookableProviders: BookableProviderCounter;
}

const toCityView = (city: CityRow): CityView => ({
  slug: city.slug,
  name: city.name,
  countryCode: city.countryCode,
  timezone: city.timezone,
  currency: city.currency,
});

export function createCatalogueService({
  repository,
  countBookableProviders,
}: CatalogueServiceDeps) {
  return {
    async listCities(): Promise<CityView[]> {
      return (await repository.listCities()).map(toCityView);
    },

    async listCategories(filter: CategoryFilter): Promise<CategoryView[]> {
      return repository.listCategories(filter);
    },

    async getCategory(
      slug: string,
      options: Pick<CategoryFilter, 'language' | 'citySlug'>,
    ): Promise<CategoryDetailView> {
      const category = await repository.findCategory(slug, options.language);
      // Inactive and unknown categories are indistinguishable to customers.
      if (!category) {
        throw new AppError(404, ErrorCode.NotFound, 'Service category not found.');
      }

      const [cities, availableProviderCount] = await Promise.all([
        repository.listCitiesOffering(category.id),
        countBookableProviders({
          serviceCategoryId: category.id,
          ...(options.citySlug === undefined ? {} : { citySlug: options.citySlug }),
        }),
      ]);
      return { ...category, cities: cities.map(toCityView), availableProviderCount };
    },
  };
}

export type CatalogueService = ReturnType<typeof createCatalogueService>;
