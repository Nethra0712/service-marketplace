import { and, desc, eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { adminAuditLog, type AdminAuditAction } from '../../db/schema/index.js';
import type { Clock } from '../../lib/clock.js';

export interface AuditLogEntryView {
  id: string;
  adminUserId: string;
  action: AdminAuditAction;
  targetType: string;
  targetId: string;
  details: unknown;
  createdAt: string;
}

export interface AuditLogFilter {
  action?: AdminAuditAction | undefined;
  targetType?: string | undefined;
  limit: number;
}

export interface AuditLogServiceDeps {
  db: Database;
  clock: Clock;
}

/**
 * Records every sensitive admin action. Insert-only by construction: this
 * service has no update or delete method, and none of its callers (every
 * other admin service) ever asks for one — see `admin-audit-log.ts`'s doc
 * comment on why that is the actual enforcement, not a permission check.
 */
export function createAuditLogService({ db, clock }: AuditLogServiceDeps) {
  return {
    async record(entry: {
      adminUserId: string;
      action: AdminAuditAction;
      targetType: string;
      targetId: string;
      details?: Record<string, unknown> | undefined;
    }): Promise<void> {
      await db.insert(adminAuditLog).values({
        adminUserId: entry.adminUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        details: entry.details ?? null,
        createdAt: clock(),
      });
    },

    async list(filter: AuditLogFilter): Promise<AuditLogEntryView[]> {
      const conditions = [
        filter.action ? eq(adminAuditLog.action, filter.action) : undefined,
        filter.targetType ? eq(adminAuditLog.targetType, filter.targetType) : undefined,
      ].filter((c) => c !== undefined);

      const rows = await db
        .select()
        .from(adminAuditLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(filter.limit);

      return rows.map((row) => ({
        id: row.id,
        adminUserId: row.adminUserId,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        details: row.details,
        createdAt: row.createdAt.toISOString(),
      }));
    },
  };
}

export type AuditLogService = ReturnType<typeof createAuditLogService>;
