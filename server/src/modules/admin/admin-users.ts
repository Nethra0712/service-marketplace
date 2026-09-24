import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { profiles, providerProfiles, users, type UserStatus } from '../../db/schema/index.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import type { AuditLogService } from './audit-log.service.js';

export interface AdminUserRow {
  id: string;
  phoneE164: string;
  fullName: string | null;
  status: UserStatus;
  isProvider: boolean;
  createdAt: Date;
}

const notFound = () => new AppError(404, ErrorCode.NotFound, 'User not found.');

const rowColumns = {
  id: users.id,
  phoneE164: users.phoneE164,
  fullName: profiles.fullName,
  status: users.status,
  createdAt: users.createdAt,
  providerProfileId: providerProfiles.id,
};

function toRow({
  providerProfileId,
  ...rest
}: { providerProfileId: string | null } & Omit<AdminUserRow, 'isProvider'>): AdminUserRow {
  return { ...rest, isProvider: providerProfileId !== null };
}

export interface AdminUsersServiceDeps {
  db: Database;
  audit: AuditLogService;
}

/**
 * Admin visibility into user accounts and suspension. There is no dedicated
 * "users" module elsewhere in the app (customers and providers are both just
 * `users` rows — see `users.ts`'s own doc comment), so this is the first and
 * only place account status is administered.
 */
export function createAdminUsersService({ db, audit }: AdminUsersServiceDeps) {
  async function fetchRow(id: string): Promise<AdminUserRow> {
    const [row] = await db
      .select(rowColumns)
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    if (!row) throw notFound();
    return toRow(row);
  }

  return {
    async list(filter: {
      search?: string | undefined;
      status?: UserStatus | undefined;
      limit: number;
    }): Promise<AdminUserRow[]> {
      const conditions = [
        isNull(users.deletedAt),
        filter.status ? eq(users.status, filter.status) : undefined,
        filter.search
          ? or(
              ilike(users.phoneE164, `%${filter.search}%`),
              ilike(profiles.fullName, `%${filter.search}%`),
            )
          : undefined,
      ].filter((c) => c !== undefined);

      const rows = await db
        .select(rowColumns)
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(users.createdAt))
        .limit(filter.limit);
      return rows.map(toRow);
    },

    get: fetchRow,

    async suspend(adminUserId: string, id: string, reason: string): Promise<AdminUserRow> {
      const [updated] = await db
        .update(users)
        .set({ status: 'suspended' })
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .returning({ id: users.id });
      if (!updated) throw notFound();

      await audit.record({
        adminUserId,
        action: 'user_suspended',
        targetType: 'user',
        targetId: id,
        details: { reason },
      });
      return fetchRow(id);
    },

    async reactivate(adminUserId: string, id: string): Promise<AdminUserRow> {
      const [updated] = await db
        .update(users)
        .set({ status: 'active' })
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .returning({ id: users.id });
      if (!updated) throw notFound();

      await audit.record({
        adminUserId,
        action: 'user_reactivated',
        targetType: 'user',
        targetId: id,
      });
      return fetchRow(id);
    },
  };
}

export type AdminUsersService = ReturnType<typeof createAdminUsersService>;
