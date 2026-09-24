import { Router } from 'express';
import { z } from 'zod';

import { parseRequest } from '../../lib/validation.js';
import type { AuditLogService } from './audit-log.service.js';

const schemas = {
  list: z.object({
    query: z.object({
      action: z
        .enum([
          'provider_application_reviewed',
          'provider_profile_reviewed',
          'user_suspended',
          'user_reactivated',
          'category_created',
          'category_updated',
          'payment_refunded',
          'payout_marked_paid',
          'review_hidden',
        ])
        .optional(),
      targetType: z.string().trim().max(100).optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }),
  }),
};

/**
 * Read-only: this router has no POST/PATCH/DELETE, anywhere, on purpose —
 * see `admin-audit-log.ts`'s doc comment on why that is what actually makes
 * the trail "not editable by normal admins".
 *
 *   GET / ?action= &targetType= &limit=
 */
export function createAuditLogRouter(service: AuditLogService): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    const { query } = parseRequest(schemas.list, req);
    res.json({ items: await service.list(query) });
  });
  return router;
}
