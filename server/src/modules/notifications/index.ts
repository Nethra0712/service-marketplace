import type { RequestHandler, Router } from 'express';

import type { AppConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import type { Logger } from '../../lib/logger.js';
import { createPushProvider } from './create-push-provider.js';
import { createNotificationsRouter } from './notifications.routes.js';
import { createNotificationsService, type NotificationsService } from './notifications.service.js';

export { MockPushProvider } from './mock-push-provider.js';
export type { PushProvider } from './push-provider.js';
export type {
  NotificationEvent,
  NotificationsService,
  NotificationView,
} from './notifications.service.js';

export interface NotificationsModuleDeps {
  db: Database;
  clock: Clock;
  logger: Logger;
  config: Pick<AppConfig, 'nodeEnv' | 'pushProvider' | 'fcm'>;
  requireAuth: RequestHandler;
}

export interface NotificationsModule {
  /** Mount at /api/notifications. */
  router: Router;
  service: NotificationsService;
}

/** The notifications module's public surface: other modules call `service.notify` only. */
export function createNotificationsModule({
  db,
  clock,
  logger,
  config,
  requireAuth,
}: NotificationsModuleDeps): NotificationsModule {
  const provider = createPushProvider(
    { pushProvider: config.pushProvider, nodeEnv: config.nodeEnv, fcm: config.fcm },
    logger,
  );
  const service = createNotificationsService({ db, clock, provider, logger });
  return { router: createNotificationsRouter({ service, requireAuth }), service };
}
