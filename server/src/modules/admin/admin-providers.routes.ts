import { Router } from 'express';
import { z } from 'zod';

import { AppError, ErrorCode } from '../../lib/errors.js';
import { parseRequest } from '../../lib/validation.js';
import { getAdminAuth } from './require-admin-auth.js';
import type { AdminProvidersService } from './admin-providers.js';

const schemas = {
  list: z.object({
    query: z.object({
      q: z.string().trim().max(200).optional(),
      verificationStatus: z.enum(['draft', 'submitted', 'verified', 'rejected']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  }),
  detail: z.object({ params: z.object({ id: z.uuid() }) }),
  reviewApplication: z.object({
    params: z.object({ id: z.uuid(), applicationId: z.uuid() }),
    body: z.object({
      decision: z.enum(['approved', 'rejected', 'suspended']),
      note: z.string().trim().max(500).optional(),
    }),
  }),
  reviewProfile: z.object({
    params: z.object({ id: z.uuid() }),
    body: z.object({
      decision: z.enum(['verified', 'rejected']),
      note: z.string().trim().max(500).optional(),
    }),
  }),
};

/**
 *   GET  /providers                                     ?q= &verificationStatus= &limit=
 *   GET  /providers/:id
 *   POST /providers/:id/applications/:applicationId/review
 *   POST /providers/:id/profile/review
 */
export function createAdminProvidersRouter(service: AdminProvidersService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { query } = parseRequest(schemas.list, req);
    res.json({
      items: await service.list({
        search: query.q,
        verificationStatus: query.verificationStatus,
        limit: query.limit,
      }),
    });
  });

  router.get('/:id', async (req, res) => {
    const { params } = parseRequest(schemas.detail, req);
    const detail = await service.getDetail(params.id);
    if (!detail) throw new AppError(404, ErrorCode.NotFound, 'Provider not found.');
    res.json(detail);
  });

  router.post('/:id/applications/:applicationId/review', async (req, res) => {
    const { params, body } = parseRequest(schemas.reviewApplication, req);
    await service.reviewApplication(
      getAdminAuth(req).adminUserId,
      params.applicationId,
      body.decision,
      body.note,
    );
    res.status(204).send();
  });

  router.post('/:id/profile/review', async (req, res) => {
    const { params, body } = parseRequest(schemas.reviewProfile, req);
    await service.reviewProfile(getAdminAuth(req).adminUserId, params.id, body.decision, body.note);
    res.status(204).send();
  });

  return router;
}
