import { Router } from 'express';

import type { DashboardService } from './dashboard.js';

/** GET / — operational metrics for the dashboard landing page. */
export function createDashboardRouter(service: DashboardService): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await service.getMetrics());
  });
  return router;
}
