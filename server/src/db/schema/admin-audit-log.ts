import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { adminUsers } from './admin-users.js';
import { adminAuditAction } from './enums.js';

/**
 * An immutable record of every sensitive admin action (provider approval,
 * user suspension, category changes, refunds, payout changes, review
 * moderation, ...). Insert-only: no route ever updates or deletes a row here
 * — "not editable by normal admins" is enforced structurally, by there being
 * nothing to call, not by a permission check that could be bypassed.
 *
 * `targetId` is deliberately untyped (no foreign key): it points at rows
 * across several different tables depending on `action`, and an audit entry
 * must survive even if its target is later deleted.
 */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    adminUserId: uuid()
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'restrict' }),
    action: adminAuditAction().notNull(),
    targetType: text().notNull(),
    targetId: uuid().notNull(),
    /** Freeform context for this action, e.g. `{ decision: 'approved' }` or `{ from: 'pending', to: 'paid' }`. */
    details: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('admin_audit_log_admin_user_id_idx').on(t.adminUserId),
    index('admin_audit_log_target_idx').on(t.targetType, t.targetId),
    index('admin_audit_log_created_at_idx').on(t.createdAt),
    check('admin_audit_log_target_type_not_blank', sql`btrim(${t.targetType}) <> ''`),
  ],
);

export type AdminAuditLogEntry = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLogEntry = typeof adminAuditLog.$inferInsert;
