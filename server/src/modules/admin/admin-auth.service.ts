import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { adminUsers } from '../../db/schema/index.js';
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
}

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

export function createAdminAuthService({ db, sessions }: AdminAuthServiceDeps) {
  return {
    /** Verifies credentials and starts a session. Throws the same error for an unknown email and a wrong password. */
    async login(
      email: string,
      password: string,
    ): Promise<{ admin: AdminIdentity; token: string; expiresAt: Date }> {
      const [row] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, email.trim().toLowerCase()));

      const valid = await verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);
      if (!row || !valid) throw invalidCredentials();

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
