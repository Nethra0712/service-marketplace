import type { RequestHandler, Router } from 'express';

import type { Database } from '../../db/client.js';
import { createReviewsBookingRouter, createReviewsProviderRouter } from './reviews.routes.js';
import { createReviewsService, type ReviewsService } from './reviews.service.js';

export type { RatingSummary } from './reviews.repository.js';
export type { ReviewsService, ReviewView } from './reviews.service.js';

export interface ReviewsModuleDeps {
  db: Database;
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
export function createReviewsModule({ db, requireAuth }: ReviewsModuleDeps): ReviewsModule {
  const service = createReviewsService({ db });
  return {
    bookingRouter: createReviewsBookingRouter({ service, requireAuth }),
    providerRouter: createReviewsProviderRouter({ service, requireAuth }),
    service,
  };
}
