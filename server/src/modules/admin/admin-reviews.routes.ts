import { Router } from 'express';
import { z } from 'zod';

import { parseRequest } from '../../lib/validation.js';
import { getAdminAuth } from './require-admin-auth.js';
import type { AdminReviewsService } from './admin-reviews.js';

// `z.coerce.boolean()` would treat the STRING "false" as truthy (any
// non-empty string coerces to true) — a real bug a test caught. This checks
// the literal query value instead.
const booleanQueryParam = z.enum(['true', 'false']).transform((v) => v === 'true');

const schemas = {
  list: z.object({
    query: z.object({
      q: z.string().trim().max(200).optional(),
      hidden: booleanQueryParam.optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  }),
  hide: z.object({
    params: z.object({ id: z.uuid() }),
    body: z.object({ reason: z.string().trim().max(500).optional() }),
  }),
};

/**
 *   GET  /reviews         ?q= &hidden= &limit=
 *   POST /reviews/:id/hide
 */
export function createAdminReviewsRouter(service: AdminReviewsService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { query } = parseRequest(schemas.list, req);
    res.json({
      items: await service.list({ search: query.q, hidden: query.hidden, limit: query.limit }),
    });
  });

  router.post('/:id/hide', async (req, res) => {
    const { params, body } = parseRequest(schemas.hide, req);
    res.json(await service.hide(getAdminAuth(req).adminUserId, params.id, body.reason ?? null));
  });

  return router;
}
