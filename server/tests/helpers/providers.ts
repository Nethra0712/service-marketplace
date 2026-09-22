import type { Express } from 'express';
import { decodeJwt } from 'jose';
import request from 'supertest';

import type { Database } from '../../src/db/client.js';
import { providerProfiles } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import type { MockSmsProvider } from '../../src/modules/sms/index.js';
import { signIn } from './auth.js';
import { nextPhone } from './factories.js';

/** A tiny client that sends the bearer token on every call. */
export interface Api {
  get: (path: string) => request.Test;
  put: (path: string, body?: object) => request.Test;
  post: (path: string, body?: object) => request.Test;
  patch: (path: string, body?: object) => request.Test;
  del: (path: string) => request.Test;
}

export function apiFor(app: Express, accessToken?: string): Api {
  const withAuth = (test: request.Test) =>
    accessToken ? test.set('Authorization', `Bearer ${accessToken}`) : test;
  return {
    get: (path) => withAuth(request(app).get(path)),
    put: (path, body = {}) => withAuth(request(app).put(path).send(body)),
    post: (path, body = {}) => withAuth(request(app).post(path).send(body)),
    patch: (path, body = {}) => withAuth(request(app).patch(path).send(body)),
    del: (path) => withAuth(request(app).delete(path)),
  };
}

/** Signs a brand-new user in (through the real OTP flow) and returns a client for them. */
export async function signInUser(app: Express, sms: MockSmsProvider, phone: string = nextPhone()) {
  const { tokens } = await signIn(app, sms, phone);
  const userId = decodeJwt(tokens.accessToken).sub;
  if (!userId) throw new Error('access token has no subject');
  return { api: apiFor(app, tokens.accessToken), tokens, phone, userId };
}

export async function providerProfileIdOf(db: Database, userId: string): Promise<string> {
  const [row] = await db
    .select({ id: providerProfiles.id })
    .from(providerProfiles)
    .where(eq(providerProfiles.userId, userId));
  if (!row) throw new Error('No provider profile for that user');
  return row.id;
}

export const validProfile = {
  fullName: 'Nimal Perera',
  bio: 'Fifteen years fixing homes across Colombo.',
  yearsOfExperience: 15,
};
