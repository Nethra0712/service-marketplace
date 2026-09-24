import type { RequestHandler, Router } from 'express';

import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import { createReviewsBookingRouter, createReviewsProviderRouter } from './reviews.routes.js';
import { createReviewsService, type ReviewsService } from './reviews.service.js';

export type { AdminReviewFilter, AdminReviewRow, RatingSummary } from './reviews.repository.js';
export type { ReviewsService, ReviewView } from './reviews.service.js';

export interface ReviewsModuleDeps {
  db: Database;
  clock: Clock;
  requireAuth: RequestHandler;
}

export interface ReviewsModule {
  /** Mount at /api/bookings, alongside the bookings module's own router. */
  bookingRouter: Router;
  /** Mount at /api/reviews. */
  providerRouter: Router;
  service: ReviewsService;
}

/** The reviews module's public surface. */
export function createReviewsModule({ db, clock, requireAuth }: ReviewsModuleDeps): ReviewsModule {
  const service = createReviewsService({ db, clock });
  return {
    bookingRouter: createReviewsBookingRouter({ service, requireAuth }),
    providerRouter: createReviewsProviderRouter({ service, requireAuth }),
    service,
  };
}
