import { Router } from 'express';
import { z } from 'zod';

import { AppError, ErrorCode } from '../../lib/errors.js';
import { parseRequest } from '../../lib/validation.js';
import type { AdminBookingsService } from './admin-bookings.js';

const schemas = {
  list: z.object({
    query: z.object({
      q: z.string().trim().max(200).optional(),
      status: z
        .enum([
          'searching',
          'accepted',
          'en_route',
          'arrived',
          'in_progress',
          'completed',
          'cancelled',
          'expired',
        ])
        .optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  }),
  detail: z.object({ params: z.object({ id: z.uuid() }) }),
};

/**
 *   GET /bookings      ?q= &status= &limit=
 *   GET /bookings/:id  full detail: state, assignment history, cancellation
 */
export function createAdminBookingsRouter(service: AdminBookingsService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { query } = parseRequest(schemas.list, req);
    res.json({
      items: await service.list({ status: query.status, search: query.q, limit: query.limit }),
    });
  });

  router.get('/:id', async (req, res) => {
    const { params } = parseRequest(schemas.detail, req);
    const detail = await service.getDetail(params.id);
    if (!detail) throw new AppError(404, ErrorCode.NotFound, 'Booking not found.');
    res.json(detail);
  });

  return router;
}
