import type { Express } from 'express';
import request from 'supertest';
import { expect } from 'vitest';

import type { MockSmsProvider } from '../../src/modules/sms/index.js';
import { nextPhone } from './factories.js';

export interface Tokens {
  tokenType: string;
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresInSeconds: number;
}

export interface OtpChallengeResponse {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export const requestOtp = (app: Express, phone: string) =>
  request(app).post('/api/auth/otp/request').send({ phone });

export const verifyOtp = (app: Express, challengeId: string, code: string) =>
  request(app).post('/api/auth/otp/verify').send({ challengeId, code });

export const refreshTokens = (app: Express, refreshToken: string) =>
  request(app).post('/api/auth/refresh').send({ refreshToken });

export const logout = (app: Express, refreshToken: string) =>
  request(app).post('/api/auth/logout').send({ refreshToken });

export const me = (app: Express, accessToken: string) =>
  request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

/** The code the mock SMS provider "delivered" to `phone`. Fails loudly if none was sent. */
export function codeSentTo(sms: MockSmsProvider, phone: string): string {
  const code = sms.lastCodeTo(phone);
  if (!code) throw new Error(`No SMS was sent to ${phone}`);
  return code;
}

/** Requests an OTP and returns the challenge id together with the delivered code. */
export async function startChallenge(app: Express, sms: MockSmsProvider, phone: string) {
  const res = await requestOtp(app, phone);
  expect(res.status).toBe(202);
  const { challengeId } = res.body as OtpChallengeResponse;
  return { challengeId, code: codeSentTo(sms, phone) };
}

/** The whole happy path: request a code, read it from the mock SMS, verify it. */
export async function signIn(app: Express, sms: MockSmsProvider, phone: string = nextPhone()) {
  const { challengeId, code } = await startChallenge(app, sms, phone);
  const res = await verifyOtp(app, challengeId, code);
  expect(res.status).toBe(200);
  return { phone, challengeId, code, tokens: res.body as Tokens };
}
