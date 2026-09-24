import type { RequestHandler, Router } from 'express';

import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import { createProvidersRouter } from './providers.routes.js';
import { createProvidersService, type ProvidersService } from './providers.service.js';
import { createReviewService, type ReviewService } from './review.service.js';

export type { ApplicationView, ProviderProfileView } from './providers.service.js';
export type { DispatchCandidate, OfferedService } from './providers.repository.js';
export {
  createReviewService,
  type ApplicationDecision,
  type ProfileDecision,
  type ReviewService,
} from './review.service.js';

export interface ProvidersModuleDeps {
  db: Database;
  clock: Clock;
  /** From the auth module: protects every provider route. */
  requireAuth: RequestHandler;
}

export interface ProvidersModule {
  /** Mount at /api/provider. */
  router: Router;
  /** Provider self-service plus the bookable-provider gate. */
  service: ProvidersService;
  /**
   * Reviewer operations (approve, reject, suspend). NOT reachable over HTTP; for
   * tests, the dev-only review script, and the future admin module.
   */
  review: ReviewService;
}

/** The providers module's public surface. */
export function createProvidersModule({
  db,
  clock,
  requireAuth,
}: ProvidersModuleDeps): ProvidersModule {
  const service = createProvidersService({ db, clock });
  return {
    router: createProvidersRouter({ service, requireAuth }),
    service,
    review: createReviewService({ db, clock }),
  };
}
