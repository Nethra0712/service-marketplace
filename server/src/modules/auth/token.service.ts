import { randomUUID } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import type { Clock } from '../../lib/clock.js';

const ISSUER = 'service-marketplace-api';
const AUDIENCE = 'service-marketplace-app';
/** Allowed difference between server clocks, in seconds. */
const CLOCK_TOLERANCE_SECONDS = 5;

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
}

const claimsSchema = z.object({ sub: z.uuid(), sid: z.uuid() });

export interface TokenServiceDeps {
  secret: string;
  ttlSeconds: number;
  clock: Clock;
}

/**
 * Signs and verifies access tokens: short-lived HS256 JWTs.
 *
 * The token only proves who the caller is and which session it belongs to; the
 * session's current state is checked against the database on every request,
 * because a signature alone cannot be revoked.
 */
export function createAccessTokenService({ secret, ttlSeconds, clock }: TokenServiceDeps) {
  const key = new TextEncoder().encode(secret);

  async function sign(
    claims: AccessTokenClaims,
  ): Promise<{ token: string; expiresInSeconds: number }> {
    const issuedAt = Math.floor(clock().getTime() / 1000);
    const token = await new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ttlSeconds)
      .setJti(randomUUID())
      .sign(key);
    return { token, expiresInSeconds: ttlSeconds };
  }

  /**
   * Returns the claims of a valid token. Throws for anything else (bad
   * signature, wrong algorithm, expired, wrong issuer/audience, malformed
   * claims). The algorithm is pinned so an `alg: none` or algorithm-swap token
   * is rejected.
   */
  async function verify(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: clock(),
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    const claims = claimsSchema.parse(payload);
    return { userId: claims.sub, sessionId: claims.sid };
  }

  return { sign, verify };
}

export type AccessTokenService = ReturnType<typeof createAccessTokenService>;
