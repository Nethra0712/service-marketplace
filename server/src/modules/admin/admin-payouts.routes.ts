import { Router } from 'express';
import { z } from 'zod';

import { parseRequest } from '../../lib/validation.js';
import { getAdminAuth } from './require-admin-auth.js';
import type { AdminPayoutsService } from './admin-payouts.js';

const schemas = {
  list: z.object({
    query: z.object({
      status: z.enum(['pending', 'paid', 'cancelled']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  }),
  forProvider: z.object({ params: z.object({ providerProfileId: z.uuid() }) }),
  calculate: z.object({
    body: z.object({
      periodStart: z.iso.datetime({ offset: true }),
      periodEnd: z.iso.datetime({ offset: true }),
    }),
  }),
  markPaid: z.object({
    params: z.object({ id: z.uuid() }),
    body: z.object({ note: z.string().trim().max(500).optional() }),
  }),
};

/**
 *   GET  /payouts                              ?status= &limit=
 *   GET  /payouts/providers/:providerProfileId  one provider's payout history
 *   POST /payouts/calculate                     { periodStart, periodEnd }
 *   POST /payouts/:id/mark-paid                 { note? }
 */
export function createAdminPayoutsRouter(service: AdminPayoutsService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { query } = parseRequest(schemas.list, req);
    res.json({ items: await service.list({ status: query.status, limit: query.limit }) });
  });

  router.get('/providers/:providerProfileId', async (req, res) => {
    const { params } = parseRequest(schemas.forProvider, req);
    res.json({ items: await service.listForProvider(params.providerProfileId) });
  });

  router.post('/calculate', async (req, res) => {
    const { body } = parseRequest(schemas.calculate, req);
    res.status(201).json({ items: await service.calculate(body.periodStart, body.periodEnd) });
  });

  router.post('/:id/mark-paid', async (req, res) => {
    const { params, body } = parseRequest(schemas.markPaid, req);
    res.json(await service.markPaid(getAdminAuth(req).adminUserId, params.id, body.note ?? null));
  });

  return router;
}
