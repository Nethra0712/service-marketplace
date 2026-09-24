import type { Database } from '../../db/client.js';
import type { DevicePlatform, Notification, NotificationKind } from '../../db/schema/index.js';
import type { Clock } from '../../lib/clock.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import { buildNotificationCopy, type NotificationCopyParams } from './notification-copy.js';
import { createNotificationsRepository } from './notifications.repository.js';
import type { PushProvider } from './push-provider.js';

/**
 * One event worth telling someone about. `bookingId`/`paymentId`/`payoutId`
 * is whichever one this event is about — exactly one is set, and it doubles
 * as the source id in the dedupe key (see `dedupeKeyFor`), so the same
 * underlying event can never notify the same recipient twice.
 */
export interface NotificationEvent {
  kind: NotificationKind;
  recipientUserId: string;
  bookingId?: string;
  paymentId?: string;
  payoutId?: string;
  /** Interpolated into the recipient's own localized copy (e.g. amount/currency for payment events). */
  params?: NotificationCopyParams;
}

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  bookingId: string | null;
  paymentId: string | null;
  payoutId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsServiceDeps {
  db: Database;
  clock: Clock;
  provider: PushProvider;
  logger?: Logger;
}

const DEFAULT_LIST_LIMIT = 30;
const MAX_LIST_LIMIT = 100;
const MAX_TOKEN_LENGTH = 4096;

const notFound = (message: string) => new AppError(404, ErrorCode.NotFound, message);
const notOwned = () =>
  new AppError(403, ErrorCode.DeviceTokenNotOwned, 'You do not own this device token.');
const invalidToken = () =>
  new AppError(
    400,
    ErrorCode.ValidationError,
    'Device token is required and must be a reasonable length.',
  );

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

const toView = (row: Notification): NotificationView => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  bookingId: row.bookingId,
  paymentId: row.paymentId,
  payoutId: row.payoutId,
  readAt: iso(row.readAt),
  createdAt: row.createdAt.toISOString(),
});

/** `<kind>:<sourceId>` — see `notifications.ts`'s doc comment on `dedupe_key`. */
const dedupeKeyFor = (event: NotificationEvent): string =>
  `${event.kind}:${event.paymentId ?? event.payoutId ?? event.bookingId}`;

/**
 * Device tokens, push preferences and the in-app notification feed.
 *
 * `notify` is the module's one entry point for raising an event: it always
 * creates the durable in-app record first (an important event is never only
 * an ephemeral push — see the module's schema doc comment), and only sends a
 * push for a record it just created — a duplicate event for the same
 * recipient is silently absorbed by the `(user_id, dedupe_key)` unique index
 * and never re-sent.
 */
export function createNotificationsService({
  db,
  clock,
  provider,
  logger,
}: NotificationsServiceDeps) {
  const repository = createNotificationsRepository(db);

  return {
    // ---- device tokens -------------------------------------------------

    async registerToken(userId: string, token: string, platform: DevicePlatform): Promise<void> {
      const trimmed = token.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_TOKEN_LENGTH) throw invalidToken();
      await repository.upsertToken(userId, trimmed, platform);
    },

    /** Also covers a token refresh: the client just registers the new token (see `upsertToken`) and removes the old one. */
    async removeToken(userId: string, token: string): Promise<void> {
      if (await repository.deleteOwnToken(userId, token)) return;
      if (await repository.tokenOwnedByAnother(userId, token)) throw notOwned();
      // Already gone (never existed, or removed already) — idempotent success.
    },

    // ---- preferences -----------------------------------------------------

    async getPreferences(userId: string): Promise<{ pushEnabled: boolean }> {
      return { pushEnabled: await repository.getPushEnabled(userId) };
    },

    async setPreferences(
      userId: string,
      preferences: { pushEnabled: boolean },
    ): Promise<{ pushEnabled: boolean }> {
      await repository.setPushEnabled(userId, preferences.pushEnabled);
      return preferences;
    },

    // ---- raising events ----------------------------------------------------

    /**
     * Records `event` for its recipient and, if it is new and they allow
     * push, sends one push per registered device. Never throws: a
     * booking/payment transition's own success must never depend on
     * notification delivery, so failures are logged and swallowed here
     * rather than by every caller.
     */
    async notify(event: NotificationEvent): Promise<void> {
      try {
        const language = await repository.findPreferredLanguage(event.recipientUserId);
        const { title, body } = buildNotificationCopy(event.kind, language, event.params ?? {});

        const inserted = await repository.insertIfNew({
          userId: event.recipientUserId,
          kind: event.kind,
          title,
          body,
          dedupeKey: dedupeKeyFor(event),
          bookingId: event.bookingId ?? null,
          paymentId: event.paymentId ?? null,
          payoutId: event.payoutId ?? null,
        });
        if (!inserted) return; // Already notified this exact event; never re-send.

        if (!(await repository.getPushEnabled(event.recipientUserId))) return;
        const tokens = await repository.listTokensForUser(event.recipientUserId);
        await Promise.all(
          tokens.map(async (token) => {
            try {
              await provider.send({
                token,
                title,
                body,
                data: {
                  kind: event.kind,
                  ...(event.bookingId ? { bookingId: event.bookingId } : {}),
                },
              });
            } catch (error) {
              logger?.warn(
                { err: error, kind: event.kind },
                "push delivery failed for one device; continuing with the recipient's other devices",
              );
            }
          }),
        );
      } catch (error) {
        logger?.error({ err: error, kind: event.kind }, 'notify() failed; continuing');
      }
    },

    // ---- the in-app feed ----------------------------------------------------

    async listNotifications(
      userId: string,
      options: { limit?: number; before?: string } = {},
    ): Promise<NotificationView[]> {
      const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
      const before = options.before ? new Date(options.before) : undefined;
      const rows = await repository.listForUser(userId, { limit, before });
      return rows.map(toView);
    },

    async getUnreadCount(userId: string): Promise<number> {
      return repository.countUnread(userId);
    },

    async markRead(userId: string, id: string): Promise<void> {
      if (await repository.markRead(userId, id, clock())) return;
      // Not updated: either it doesn't exist, belongs to someone else, or
      // was already read. The first two are reported identically — a 404
      // that never reveals which — the same posture
      // `payments.service.ts`'s `getPaymentForViewer` takes; the third is a
      // harmless idempotent success.
      if (!(await repository.isOwnedByUser(userId, id))) throw notFound('Notification not found.');
    },

    async markAllRead(userId: string): Promise<void> {
      await repository.markAllRead(userId, clock());
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
