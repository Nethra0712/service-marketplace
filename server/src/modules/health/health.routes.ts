import { Router } from 'express';

import { AppError, ErrorCode } from '../../lib/errors.js';

export interface HealthDependencies {
  /** Resolves if the database is reachable, rejects otherwise. */
  pingDatabase: () => Promise<void>;
}

/**
 * Mounted at /api/health.
 *
 *   GET /        liveness: the process is up (touches no dependency)
 *   GET /db      readiness of the database connection
 */
export function createHealthRouter({ pingDatabase }: HealthDependencies): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  router.get('/db', async (_req, res) => {
    try {
      await pingDatabase();
    } catch (cause) {
      // The driver error can contain host and role details, so it goes to the
      // logs (via `cause`) and clients only get a generic message.
      throw new AppError(503, ErrorCode.DatabaseUnavailable, 'Database is unavailable.', {
        cause,
      });
    }
    res.json({ status: 'ok', database: 'up' });
  });

  return router;
}
