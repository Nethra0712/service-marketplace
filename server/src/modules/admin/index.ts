import { Router } from 'express';

import type { AppConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import type { PaymentsService } from '../payments/index.js';
import type { ReviewService } from '../providers/index.js';
import type { ReviewsService } from '../reviews/index.js';
import { createAdminAuthRouter } from './admin-auth.routes.js';
import { createAdminAuthService } from './admin-auth.service.js';
import { createAdminBookingsRouter } from './admin-bookings.routes.js';
import { createAdminBookingsService } from './admin-bookings.js';
import { createAdminCategoriesRouter } from './admin-categories.routes.js';
import { createAdminCategoriesService } from './admin-categories.js';
import { createAdminPaymentsRouter } from './admin-payments.routes.js';
import { createAdminPaymentsService } from './admin-payments.js';
import { createAdminPayoutsRouter } from './admin-payouts.routes.js';
import { createAdminPayoutsService } from './admin-payouts.js';
import { createAdminProvidersRouter } from './admin-providers.routes.js';
import { createAdminProvidersService } from './admin-providers.js';
import { createAdminReviewsRouter } from './admin-reviews.routes.js';
import { createAdminReviewsService } from './admin-reviews.js';
import { createAdminSessionService } from './admin-session.service.js';
import { createAdminTokenService } from './admin-token.service.js';
import { createAdminUsersRouter } from './admin-users.routes.js';
import { createAdminUsersService } from './admin-users.js';
import { createAuditLogRouter } from './audit-log.routes.js';
import { createAuditLogService } from './audit-log.service.js';
import { createDashboardRouter } from './dashboard.routes.js';
import { createDashboardService } from './dashboard.js';
import { createRequireAdminAuth } from './require-admin-auth.js';
import { requireCsrf } from './require-csrf.js';

export { getAdminAuth, type AdminAuthContext } from './require-admin-auth.js';

/** One week: long enough that an admin is not signed out mid-shift, short enough that a stolen cookie is not a standing risk. */
const ADMIN_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AdminModuleDeps {
  db: Database;
  clock: Clock;
  config: Pick<AppConfig, 'nodeEnv' | 'adminJwtSecret'>;
  providerReview: ReviewService;
  payments: PaymentsService;
  reviews: ReviewsService;
}

export interface AdminModule {
  /** Mount at /api/admin. Owns its own authentication (cookie session, not the mobile app's Bearer tokens). */
  router: Router;
}

/**
 * The admin module's public surface. Every route here is authorization-gated
 * server-side (`requireAdminAuth`) and CSRF-gated for mutations
 * (`requireCsrf`) — nothing about who is an admin is ever decided by the
 * Next.js admin app itself. See `require-admin-auth.ts`'s doc comment.
 */
export function createAdminModule({
  db,
  clock,
  config,
  providerReview,
  payments,
  reviews,
}: AdminModuleDeps): AdminModule {
  const isProduction = config.nodeEnv === 'production';
  const tokens = createAdminTokenService({
    secret: config.adminJwtSecret,
    ttlSeconds: ADMIN_SESSION_TTL_SECONDS,
    clock,
  });
  const sessions = createAdminSessionService({ db, clock, tokens });
  const requireAdminAuth = createRequireAdminAuth({ tokens, sessions });
  const authService = createAdminAuthService({ db, sessions });
  const audit = createAuditLogService({ db, clock });

  const router = Router();
  router.use(
    '/auth',
    createAdminAuthRouter({
      service: authService,
      requireAdminAuth,
      isProduction,
      loginRateLimit: { windowMs: 15 * 60_000, limit: 10 },
    }),
  );

  const protectedRouter = Router();
  protectedRouter.use(requireAdminAuth);
  protectedRouter.use(requireCsrf);
  protectedRouter.use('/dashboard', createDashboardRouter(createDashboardService({ db })));
  protectedRouter.use(
    '/providers',
    createAdminProvidersRouter(createAdminProvidersService({ db, review: providerReview, audit })),
  );
  protectedRouter.use(
    '/categories',
    createAdminCategoriesRouter(createAdminCategoriesService({ db, audit })),
  );
  protectedRouter.use('/bookings', createAdminBookingsRouter(createAdminBookingsService({ db })));
  protectedRouter.use(
    '/payments',
    createAdminPaymentsRouter(createAdminPaymentsService({ db, payments, audit })),
  );
  protectedRouter.use(
    '/payouts',
    createAdminPayoutsRouter(createAdminPayoutsService({ db, payments, audit })),
  );
  protectedRouter.use(
    '/reviews',
    createAdminReviewsRouter(createAdminReviewsService({ reviews, audit })),
  );
  protectedRouter.use('/users', createAdminUsersRouter(createAdminUsersService({ db, audit })));
  protectedRouter.use('/audit-log', createAuditLogRouter(audit));

  router.use(protectedRouter);
  return { router };
}
