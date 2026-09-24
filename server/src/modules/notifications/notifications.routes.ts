import { Router, type RequestHandler } from 'express';

import { getAuth } from '../auth/index.js';
import { parseRequest } from '../../lib/validation.js';
import { notificationsSchemas } from './notifications.schemas.js';
import type { NotificationsService } from './notifications.service.js';

export interface NotificationsRoutesDeps {
  service: NotificationsService;
  requireAuth: RequestHandler;
}

/**
 * Self-service device tokens, push preferences and the in-app notification
 * feed. Mounted at /api/notifications; every route is the caller's own —
 * nothing here ever takes another user's id.
 */
export function createNotificationsRouter({
  service,
  requireAuth,
}: NotificationsRoutesDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/tokens', async (req, res) => {
    const { body } = parseRequest(notificationsSchemas.registerToken, req);
    await service.registerToken(getAuth(req).userId, body.token, body.platform);
    res.status(204).send();
  });

  // A token refresh is just registering the new token and removing the old
  // one — there is no separate "refresh" endpoint (see `removeToken`'s doc
  // comment).
  router.delete('/tokens', async (req, res) => {
    const { body } = parseRequest(notificationsSchemas.removeToken, req);
    await service.removeToken(getAuth(req).userId, body.token);
    res.status(204).send();
  });

  router.get('/preferences', async (req, res) => {
    res.json(await service.getPreferences(getAuth(req).userId));
  });

  router.put('/preferences', async (req, res) => {
    const { body } = parseRequest(notificationsSchemas.setPreferences, req);
    res.json(await service.setPreferences(getAuth(req).userId, body));
  });

  router.get('/', async (req, res) => {
    const { query } = parseRequest(notificationsSchemas.list, req);
    const [items, unreadCount] = await Promise.all([
      service.listNotifications(getAuth(req).userId, query),
      service.getUnreadCount(getAuth(req).userId),
    ]);
    res.json({ items, unreadCount });
  });

  router.post('/:id/read', async (req, res) => {
    const { params } = parseRequest(notificationsSchemas.markRead, req);
    await service.markRead(getAuth(req).userId, params.id);
    res.status(204).send();
  });

  router.post('/read-all', async (req, res) => {
    await service.markAllRead(getAuth(req).userId);
    res.status(204).send();
  });

  return router;
}
