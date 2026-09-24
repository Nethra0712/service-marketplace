import { and, eq, isNull } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { adminSessions } from '../../db/schema/index.js';
import { addSeconds, type Clock } from '../../lib/clock.js';
import type { AdminTokenService } from './admin-token.service.js';

export type AdminSessionCheck = { ok: true } | { ok: false };

export interface AdminSessionServiceDeps {
  db: Database;
  clock: Clock;
  tokens: AdminTokenService;
}

/**
 * Admin sessions, one per login. Simpler than the mobile app's
 * access+refresh pair (`session.service.ts`): a single moderate-TTL session
 * token, re-checked against `admin_sessions` on every request so a logout or
 * revocation takes effect immediately — see `admin-token.service.ts`'s doc
 * comment. There is no silent refresh; an expired admin session just signs
 * back in, which is an acceptable trade for an internal tool.
 */
export function createAdminSessionService({ db, clock, tokens }: AdminSessionServiceDeps) {
  return {
    /** Starts a session and returns its signed cookie value. */
    async createSession(adminUserId: string): Promise<{ token: string; expiresAt: Date }> {
      const now = clock();
      const expiresAt = addSeconds(now, tokens.ttlSeconds);
      const [session] = await db
        .insert(adminSessions)
        .values({ adminUserId, expiresAt, createdAt: now })
        .returning({ id: adminSessions.id });
      if (!session) throw new Error('Admin session insert returned no row');

      const token = await tokens.sign({ adminUserId, sessionId: session.id });
      return { token, expiresAt };
    },

    /** Is this session still active (not revoked, not expired)? */
    async checkSession(sessionId: string, adminUserId: string): Promise<AdminSessionCheck> {
      const now = clock();
      const [row] = await db
        .select({ revokedAt: adminSessions.revokedAt, expiresAt: adminSessions.expiresAt })
        .from(adminSessions)
        .where(and(eq(adminSessions.id, sessionId), eq(adminSessions.adminUserId, adminUserId)));

      if (!row) return { ok: false };
      const stillActive = row.revokedAt === null && row.expiresAt.getTime() > now.getTime();
      return stillActive ? { ok: true } : { ok: false };
    },

    /** Always succeeds, even for an unknown or already-revoked session — logout cannot be used to probe which ones exist. */
    async revokeSession(sessionId: string): Promise<void> {
      await db
        .update(adminSessions)
        .set({ revokedAt: clock() })
        .where(and(eq(adminSessions.id, sessionId), isNull(adminSessions.revokedAt)));
    },
  };
}

export type AdminSessionService = ReturnType<typeof createAdminSessionService>;
