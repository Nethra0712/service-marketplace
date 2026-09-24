import { Router, type RequestHandler } from 'express';

import { getAuth } from '../auth/index.js';
import { parseRequest } from '../../lib/validation.js';
import { reviewsSchemas } from './reviews.schemas.js';
import type { ReviewsService } from './reviews.service.js';

export interface ReviewsRoutesDeps {
  service: ReviewsService;
  requireAuth: RequestHandler;
}

/**
 * Review routes nested under a booking. Mounted at /api/bookings, alongside
 * (not instead of) the bookings and payments modules' own routers — all
 * three match the same prefix, on disjoint paths.
 *
 *   POST /:id/review    the caller reviews the booking's other participant
 *   GET  /:id/reviews    the caller's own review of this booking, and the counterpart's
 */
export function createReviewsBookingRouter({ service, requireAuth }: ReviewsRoutesDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/:id/review', async (req, res) => {
    const { params, body } = parseRequest(reviewsSchemas.submit, req);
    const review = await service.submitReview(getAuth(req).userId, params.id, body);
    res.status(201).json(review);
  });

  router.get('/:id/reviews', async (req, res) => {
    const { params } = parseRequest(reviewsSchemas.forBooking, req);
    res.json(await service.getForBooking(getAuth(req).userId, params.id));
  });

  return router;
}

/** A provider's aggregate rating. Mounted at /api/reviews. */
export function createReviewsProviderRouter({ service, requireAuth }: ReviewsRoutesDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/providers/:providerProfileId/summary', async (req, res) => {
    const { params } = parseRequest(reviewsSchemas.providerSummary, req);
    res.json(await service.getProviderRatingSummary(params.providerProfileId));
  });

  return router;
}
