import { Router } from 'express';
import { z } from 'zod';

import { parseRequest } from '../../lib/validation.js';
import { getAdminAuth } from './require-admin-auth.js';
import type { AdminCategoriesService } from './admin-categories.js';

const SLUG = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const schemas = {
  create: z.object({
    body: z.object({
      slug: SLUG,
      name: z.string().trim().min(1).max(100),
      description: z.string().trim().max(1000).optional(),
      pricingModel: z.enum(['fixed', 'hourly', 'quote']),
      baseRate: z.number().positive().max(1_000_000).optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.uuid() }),
    body: z.object({
      name: z.string().trim().min(1).max(100).optional(),
      description: z.string().trim().max(1000).nullable().optional(),
      pricingModel: z.enum(['fixed', 'hourly', 'quote']).optional(),
      baseRate: z.number().positive().max(1_000_000).nullable().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
};

/**
 *   GET   /categories
 *   POST  /categories
 *   PATCH /categories/:id   also activates/deactivates (isActive) and edits pricing
 */
export function createAdminCategoriesRouter(service: AdminCategoriesService): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ items: await service.list() });
  });

  router.post('/', async (req, res) => {
    const { body } = parseRequest(schemas.create, req);
    res.status(201).json(await service.create(getAdminAuth(req).adminUserId, body));
  });

  router.patch('/:id', async (req, res) => {
    const { params, body } = parseRequest(schemas.update, req);
    res.json(await service.update(getAdminAuth(req).adminUserId, params.id, body));
  });

  return router;
}
