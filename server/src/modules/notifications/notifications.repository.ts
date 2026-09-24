import { and, desc, eq, isNull, lt } from 'drizzle-orm';

import type { Queryable } from '../../db/client.js';
import {
  deviceTokens,
  notificationPreferences,
  notifications,
  profiles,
  type AppLanguage,
  type DevicePlatform,
  type Notification,
  type NotificationKind,
} from '../../db/schema/index.js';

export interface NewNotificationInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  dedupeKey: string;
  bookingId?: string | null;
  paymentId?: string | null;
  payoutId?: string | null;
}

/** All device-token, preference and notification-record data access. */
export function createNotificationsRepository(db: Queryable) {
  return {
    // ---- device tokens -------------------------------------------------

    /** Registers a token, or reassigns it if it already exists (see `device-tokens.ts`'s doc comment). */
    async upsertToken(userId: string, token: string, platform: DevicePlatform): Promise<void> {
      await db
        .insert(deviceTokens)
        .values({ userId, token, platform })
        .onConflictDoUpdate({ target: deviceTokens.token, set: { userId, platform } });
    },

    /** Removes a token, but only if the caller owns it. `false` covers both "not found" and "owned by someone else". */
    async deleteOwnToken(userId: string, token: string): Promise<boolean> {
      const deleted = await db
        .delete(deviceTokens)
        .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)))
        .returning({ id: deviceTokens.id });
      return deleted.length > 0;
    },

    async tokenOwnedByAnother(userId: string, token: string): Promise<boolean> {
      const [row] = await db
        .select({ userId: deviceTokens.userId })
        .from(deviceTokens)
        .where(eq(deviceTokens.token, token));
      return row !== undefined && row.userId !== userId;
    },

    async listTokensForUser(userId: string): Promise<string[]> {
      const rows = await db
        .select({ token: deviceTokens.token })
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId));
      return rows.map((r) => r.token);
    },

    // ---- preferences -----------------------------------------------------

    /** Defaults to enabled: absence of a row means every default applies. */
    async getPushEnabled(userId: string): Promise<boolean> {
      const [row] = await db
        .select({ pushEnabled: notificationPreferences.pushEnabled })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
      return row?.pushEnabled ?? true;
    },

    async setPushEnabled(userId: string, pushEnabled: boolean): Promise<void> {
      await db
        .insert(notificationPreferences)
        .values({ userId, pushEnabled })
        .onConflictDoUpdate({ target: notificationPreferences.userId, set: { pushEnabled } });
    },

    /** The RECIPIENT's own preferred language — never the caller's, since the two may differ. Defaults to English. */
    async findPreferredLanguage(userId: string): Promise<AppLanguage> {
      const [row] = await db
        .select({ preferredLanguage: profiles.preferredLanguage })
        .from(profiles)
        .where(eq(profiles.userId, userId));
      return row?.preferredLanguage ?? 'en';
    },

    // ---- notification records ---------------------------------------------

    /**
     * Inserts a new notification record, or does nothing if `(userId,
     * dedupeKey)` already exists — this exact event was already notified for
     * this recipient. Returns the inserted row, or undefined on that
     * conflict, so `notifications.service.ts`'s `notify` can tell "just
     * created" (send a push) from "already existed" (don't).
     */
    async insertIfNew(values: NewNotificationInput): Promise<Notification | undefined> {
      const [row] = await db
        .insert(notifications)
        .values(values)
        .onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })
        .returning();
      return row;
    },

    async listForUser(
      userId: string,
      { limit, before }: { limit: number; before?: Date },
    ): Promise<Notification[]> {
      return db
        .select()
        .from(notifications)
        .where(
          before
            ? and(eq(notifications.userId, userId), lt(notifications.createdAt, before))
            : eq(notifications.userId, userId),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
    },

    async isOwnedByUser(userId: string, id: string): Promise<boolean> {
      const [row] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
      return row !== undefined;
    },

    async countUnread(userId: string): Promise<number> {
      const rows = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
      return rows.length;
    },

    /** `false` covers both "not found" and "owned by someone else" — never leaks which. */
    async markRead(userId: string, id: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, userId),
            isNull(notifications.readAt),
          ),
        )
        .returning({ id: notifications.id });
      return updated.length > 0;
    },

    async markAllRead(userId: string, now: Date): Promise<void> {
      await db
        .update(notifications)
        .set({ readAt: now })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    },
  };
}

export type NotificationsRepository = ReturnType<typeof createNotificationsRepository>;
