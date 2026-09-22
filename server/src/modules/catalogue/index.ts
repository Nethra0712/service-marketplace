import type { Router } from 'express';

import type { Database } from '../../db/client.js';
import type { RateLimitPolicy } from '../../middleware/ip-rate-limit.js';
import { createCatalogueRepository } from './catalogue.repository.js';
import { createCatalogueRouter } from './catalogue.routes.js';
import {
  createCatalogueService,
  type BookableProviderCounter,
  type CatalogueService,
} from './catalogue.service.js';

export type { CategoryView, CategoryDetailView, CityView } from './catalogue.service.js';

/** Generous: catalogue reads are cheap, and many phones share one carrier IP. */
export const defaultCatalogueRateLimit: RateLimitPolicy = { windowMs: 15 * 60_000, limit: 600 };

export interface CatalogueModuleDeps {
  db: Database;
  countBookableProviders: BookableProviderCounter;
  rateLimit?: RateLimitPolicy;
}

export interface CatalogueModule {
  /** Mount at /api. */
  router: Router;
  service: CatalogueService;
}

/** The catalogue module's public surface. */
export function createCatalogueModule({
  db,
  countBookableProviders,
  rateLimit = defaultCatalogueRateLimit,
}: CatalogueModuleDeps): CatalogueModule {
  const service = createCatalogueService({
    repository: createCatalogueRepository(db),
    countBookableProviders,
  });
  return { router: createCatalogueRouter({ service, rateLimit }), service };
}
