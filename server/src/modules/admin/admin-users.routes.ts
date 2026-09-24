import { Router } from 'express';
import { z } from 'zod';

import { parseRequest } from '../../lib/validation.js';
import { getAdminAuth } from './require-admin-auth.js';
import type { AdminUsersService } from './admin-users.js';

const schemas = {
  list: z.object({
    query: z.object({
      q: z.string().trim().max(200).optional(),
      status: z.enum(['active', 'suspended']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  }),
  detail: z.object({ params: z.object({ id: z.uuid() }) }),
  suspend: z.object({
    params: z.object({ id: z.uuid() }),
    body: z.object({ reason: z.string().trim().min(1).max(500) }),
  }),
};

/**
 *   GET  /users            ?q= &status= &limit=
 *   GET  /users/:id
 *   POST /users/:id/suspend    { reason }
 *   POST /users/:id/reactivate
 */
export function createAdminUsersRouter(service: AdminUsersService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { query } = parseRequest(schemas.list, req);
    res.json({
      items: await service.list({ search: query.q, status: query.status, limit: query.limit }),
    });
  });

  router.get('/:id', async (req, res) => {
    const { params } = parseRequest(schemas.detail, req);
    res.json(await service.get(params.id));
  });

  router.post('/:id/suspend', async (req, res) => {
    const { params, body } = parseRequest(schemas.suspend, req);
    res.json(await service.suspend(getAdminAuth(req).adminUserId, params.id, body.reason));
  });

  router.post('/:id/reactivate', async (req, res) => {
    const { params } = parseRequest(schemas.detail, req);
    res.json(await service.reactivate(getAdminAuth(req).adminUserId, params.id));
  });

  return router;
}
