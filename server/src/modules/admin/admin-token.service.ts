import { randomUUID } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import type { Clock } from '../../lib/clock.js';

// Deliberately different from the mobile app's own ISSUER/AUDIENCE
// (`token.service.ts`) — even if the two JWT secrets were ever the same by
// accident, a mobile access token could never pass as an admin session, and
// vice versa.
const ISSUER = 'service-marketplace-admin-api';
const AUDIENCE = 'service-marketplace-admin-app';
const CLOCK_TOLERANCE_SECONDS = 5;

export interface AdminSessionClaims {
  adminUserId: string;
  sessionId: string;
}

const claimsSchema = z.object({ sub: z.uuid(), sid: z.uuid() });

export interface AdminTokenServiceDeps {
  secret: string;
  ttlSeconds: number;
  clock: Clock;
}

/**
 * Signs and verifies the admin session cookie's JWT. Structurally identical
 * to the mobile app's `token.service.ts` (short-lived, database-backed
 * session — see `admin-session.service.ts`), kept as a separate
 * implementation only so the two token *kinds* can never be confused (see
 * `ISSUER`/`AUDIENCE` above).
 */
export function createAdminTokenService({ secret, ttlSeconds, clock }: AdminTokenServiceDeps) {
  const key = new TextEncoder().encode(secret);

  async function sign(claims: AdminSessionClaims): Promise<string> {
    const issuedAt = Math.floor(clock().getTime() / 1000);
    return new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.adminUserId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ttlSeconds)
      .setJti(randomUUID())
      .sign(key);
  }

  async function verify(token: string): Promise<AdminSessionClaims> {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: clock(),
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    const claims = claimsSchema.parse(payload);
    return { adminUserId: claims.sub, sessionId: claims.sid };
  }

  return { sign, verify, ttlSeconds };
}

export type AdminTokenService = ReturnType<typeof createAdminTokenService>;
