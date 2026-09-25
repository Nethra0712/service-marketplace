import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { adminUsers } from '../../db/schema/index.js';
import { addSeconds, type Clock } from '../../lib/clock.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import { verifyPassword } from '../../lib/password.js';
import type { AdminSessionService } from './admin-session.service.js';

export interface AdminIdentity {
  id: string;
  email: string;
  fullName: string;
}

export interface AdminAuthServiceDeps {
  db: Database;
  sessions: AdminSessionService;
  clock: Clock;
}

/**
 * A per-IP limiter alone (`admin-auth.routes.ts`'s `loginRateLimit`) can be
 * stepped around by spreading guesses across many source IPs; this closes
 * that gap by tracking failures per account instead. Chosen to match the IP
 * limiter's own window/count, so the two read as one consistent policy.
 */
const MAX_FAILED_LOGIN_ATTEMPTS = 10;
const LOCKOUT_SECONDS = 15 * 60;

const invalidCredentials = () =>
  new AppError(401, ErrorCode.InvalidAdminCredentials, 'Invalid email or password.');

/**
 * A well-formed but never-derived-from-a-real-password hash. Verifying
 * against it always fails, but costs the same scrypt computation as a real
 * check — so `login` takes about the same time whether or not `email`
 * belongs to an admin, and a timing attack cannot be used to enumerate
 * admin accounts. Generated once at process start, not per request.
 */
const DUMMY_HASH = `scrypt:16384:8:1:${randomBytes(16).toString('hex')}:${randomBytes(64).toString('hex')}`;

export function createAdminAuthService({ db, sessions, clock }: AdminAuthServiceDeps) {
  return {
    /**
     * Verifies credentials and starts a session. Throws the same error for
     * an unknown email, a wrong password, and a currently-locked account —
     * none of those are ever distinguished in the response.
     */
    async login(
      email: string,
      password: string,
    ): Promise<{ admin: AdminIdentity; token: string; expiresAt: Date }> {
      const [row] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, email.trim().toLowerCase()));

      const now = clock();
      const locked = row?.lockedUntil != null && row.lockedUntil.getTime() > now.getTime();

      // Always paid, locked or not, known email or not: timing must not
      // distinguish "unknown email" from "known but wrong password" from
      // "known but currently locked".
      const valid = await verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);

      if (!row) throw invalidCredentials();

      if (locked || !valid) {
        // An already-locked account does not get its lock extended by
        // further attempts — a fixed lockout, not a sliding one, so hammering
        // a locked account can't be used to keep it locked indefinitely.
        if (!locked) {
          const attempts = row.failedLoginAttempts + 1;
          await db
            .update(adminUsers)
            .set({
              failedLoginAttempts: attempts,
              lockedUntil:
                attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? addSeconds(now, LOCKOUT_SECONDS) : null,
            })
            .where(eq(adminUsers.id, row.id));
        }
        throw invalidCredentials();
      }

      if (row.failedLoginAttempts > 0 || row.lockedUntil !== null) {
        await db
          .update(adminUsers)
          .set({ failedLoginAttempts: 0, lockedUntil: null })
          .where(eq(adminUsers.id, row.id));
      }

      const session = await sessions.createSession(row.id);
      return {
        admin: { id: row.id, email: row.email, fullName: row.fullName },
        token: session.token,
        expiresAt: session.expiresAt,
      };
    },

    async logout(sessionId: string): Promise<void> {
      await sessions.revokeSession(sessionId);
    },

    async getIdentity(adminUserId: string): Promise<AdminIdentity> {
      const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminUserId));
      if (!row) throw invalidCredentials(); // Session outlived a deleted admin row; treat as signed out.
      return { id: row.id, email: row.email, fullName: row.fullName };
    },
  };
}

export type AdminAuthService = ReturnType<typeof createAdminAuthService>;
