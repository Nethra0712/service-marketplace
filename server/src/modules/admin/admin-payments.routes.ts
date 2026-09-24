import { Router } from 'express';
import { z } from 'zod';

import { AppError, ErrorCode } from '../../lib/errors.js';
import { parseRequest } from '../../lib/validation.js';
import { getAdminAuth } from './require-admin-auth.js';
import type { AdminPaymentsService } from './admin-payments.js';

const schemas = {
  list: z.object({
    query: z.object({
      q: z.string().trim().max(200).optional(),
      status: z.enum(['pending', 'succeeded', 'failed', 'cancelled', 'refunded']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  }),
  detail: z.object({ params: z.object({ id: z.uuid() }) }),
  refund: z.object({
    params: z.object({ id: z.uuid() }),
    body: z.object({ reason: z.string().trim().min(1).max(500) }),
  }),
};

/**
 *   GET  /payments      ?q= &status= &limit=
 *   GET  /payments/:id  full detail + ledger (transaction history)
 *   POST /payments/:id/refund
 */
export function createAdminPaymentsRouter(service: AdminPaymentsService): Router {
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
    if (!detail) throw new AppError(404, ErrorCode.NotFound, 'Payment not found.');
    res.json(detail);
  });

  router.post('/:id/refund', async (req, res) => {
    const { params, body } = parseRequest(schemas.refund, req);
    res.json(await service.refund(getAdminAuth(req).adminUserId, params.id, body.reason));
  });

  return router;
}
