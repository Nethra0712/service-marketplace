import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'dotenv';
import { describe, expect, it } from 'vitest';

import { EnvValidationError, loadDatabaseEnv, loadEnv } from '../../src/config/env.js';

const JWT_SECRET = 'jwt-secret-for-tests-0123456789-abcdefghijklmnop';
const OTP_SECRET = 'otp-secret-for-tests-9876543210-ponmlkjihgfedcba';

const validEnv = {
  DATABASE_URL: 'postgresql://user:secret-pw@localhost:5432/app',
  JWT_ACCESS_SECRET: JWT_SECRET,
  OTP_HMAC_SECRET: OTP_SECRET,
};

function problemsFor(env: NodeJS.ProcessEnv): string {
  try {
    loadEnv(env);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return (error as EnvValidationError).message;
  }
  throw new Error('Expected loadEnv to throw');
}

describe('loadEnv', () => {
  it('applies defaults when only the required variables are provided', () => {
    expect(loadEnv(validEnv)).toEqual({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: validEnv.DATABASE_URL,
      corsOrigins: [],
      logLevel: 'info',
      jwtAccessSecret: JWT_SECRET,
      otpHmacSecret: OTP_SECRET,
      smsProvider: 'mock',
      allowedPhoneCountryCodes: ['94'],
      trustProxyHops: 0,
    });
  });

  it('parses explicit values, coercing numbers from strings', () => {
    const config = loadEnv({
      ...validEnv,
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: 'https://admin.example.com, http://localhost:3001',
      TRUST_PROXY_HOPS: '2',
      ALLOWED_PHONE_COUNTRY_CODES: '94, 1',
    });
    expect(config).toMatchObject({
      port: 8080,
      logLevel: 'warn',
      corsOrigins: ['https://admin.example.com', 'http://localhost:3001'],
      trustProxyHops: 2,
      allowedPhoneCountryCodes: ['94', '1'],
    });
  });

  it('requires DATABASE_URL', () => {
    expect(problemsFor({ ...validEnv, DATABASE_URL: undefined })).toContain('DATABASE_URL');
  });

  it('rejects a DATABASE_URL that is not a postgres URL', () => {
    expect(problemsFor({ ...validEnv, DATABASE_URL: 'mysql://u:p@localhost/db' })).toContain(
      'DATABASE_URL',
    );
    expect(problemsFor({ ...validEnv, DATABASE_URL: 'not a url' })).toContain('DATABASE_URL');
  });

  it.each(['abc', '0', '70000', '-1', '3000.5'])('rejects PORT=%s', (port) => {
    expect(problemsFor({ ...validEnv, PORT: port })).toContain('PORT');
  });

  it('rejects unknown NODE_ENV and LOG_LEVEL values', () => {
    expect(problemsFor({ ...validEnv, NODE_ENV: 'staging' })).toContain('NODE_ENV');
    expect(problemsFor({ ...validEnv, LOG_LEVEL: 'loud' })).toContain('LOG_LEVEL');
  });

  it.each(['https://admin.example.com/', 'https://admin.example.com/path', 'admin.example.com'])(
    'rejects CORS_ORIGINS entry %s (must be a bare origin)',
    (origin) => {
      expect(problemsFor({ ...validEnv, CORS_ORIGINS: origin })).toContain('CORS_ORIGINS');
    },
  );

  it('reports every problem at once', () => {
    const message = problemsFor({ PORT: 'nope', LOG_LEVEL: 'loud' });
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('JWT_ACCESS_SECRET');
    expect(message).toContain('OTP_HMAC_SECRET');
    expect(message).toContain('PORT');
    expect(message).toContain('LOG_LEVEL');
  });

  it('never includes credential values in error messages', () => {
    const message = problemsFor({
      DATABASE_URL: 'mysql://user:secret-pw@localhost/db',
      JWT_ACCESS_SECRET: 'too-short-secret',
      OTP_HMAC_SECRET: 'too-short-secret',
    });
    expect(message).not.toContain('secret-pw');
    expect(message).not.toContain('too-short-secret');
  });

  it('accepts the committed .env.example template in development', () => {
    const template = parse(readFileSync(path.resolve(import.meta.dirname, '../../.env.example')));
    expect(() => loadEnv(template)).not.toThrow();
  });
});

describe('loadEnv: authentication settings', () => {
  it.each(['JWT_ACCESS_SECRET', 'OTP_HMAC_SECRET'] as const)('requires %s', (name) => {
    expect(problemsFor({ ...validEnv, [name]: undefined })).toContain(name);
  });

  it.each(['JWT_ACCESS_SECRET', 'OTP_HMAC_SECRET'] as const)(
    'rejects a %s shorter than 32 characters',
    (name) => {
      const message = problemsFor({ ...validEnv, [name]: 'short' });
      expect(message).toContain(name);
      expect(message).toContain('32');
    },
  );

  it('rejects using the same secret for JWTs and OTP hashing', () => {
    const message = problemsFor({ ...validEnv, OTP_HMAC_SECRET: JWT_SECRET });
    expect(message).toContain('OTP_HMAC_SECRET must differ');
  });

  it('rejects an unknown SMS provider', () => {
    expect(problemsFor({ ...validEnv, SMS_PROVIDER: 'carrier-pigeon' })).toContain('SMS_PROVIDER');
  });

  it.each(['+94', 'ninety-four', '0094', '94,+1', '1234', ','])(
    'rejects ALLOWED_PHONE_COUNTRY_CODES=%s',
    (value) => {
      expect(problemsFor({ ...validEnv, ALLOWED_PHONE_COUNTRY_CODES: value })).toContain(
        'ALLOWED_PHONE_COUNTRY_CODES',
      );
    },
  );

  it.each(['-1', '11', 'many'])('rejects TRUST_PROXY_HOPS=%s', (value) => {
    expect(problemsFor({ ...validEnv, TRUST_PROXY_HOPS: value })).toContain('TRUST_PROXY_HOPS');
  });

  describe('in production', () => {
    const production = { ...validEnv, NODE_ENV: 'production' };

    it('refuses the mock SMS provider, so OTPs can never be logged in production', () => {
      const message = problemsFor({ ...production, SMS_PROVIDER: 'mock' });
      expect(message).toContain('SMS_PROVIDER');
      expect(message).toContain('mock');
    });

    it('refuses the mock provider even when SMS_PROVIDER is left unset (its default)', () => {
      expect(problemsFor(production)).toContain('SMS_PROVIDER');
    });

    it('refuses secrets that are still the .env.example placeholders', () => {
      const message = problemsFor({
        ...production,
        JWT_ACCESS_SECRET: 'replace-with-a-random-secret-from-openssl-rand-base64-48',
        OTP_HMAC_SECRET: 'replace-with-a-different-random-secret-from-openssl-rand',
      });
      expect(message).toContain('JWT_ACCESS_SECRET');
      expect(message).toContain('OTP_HMAC_SECRET');
      expect(message).toContain('placeholder');
    });
  });

  it('allows the same relaxed values in test and development', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(loadEnv({ ...validEnv, NODE_ENV: nodeEnv }).smsProvider).toBe('mock');
    }
  });
});

describe('loadDatabaseEnv (used by migrate, seed and purge scripts)', () => {
  it('needs only the database URL, not the authentication secrets', () => {
    expect(loadDatabaseEnv({ DATABASE_URL: validEnv.DATABASE_URL })).toEqual({
      nodeEnv: 'development',
      databaseUrl: validEnv.DATABASE_URL,
    });
  });

  it('still validates the database URL without leaking it', () => {
    expect(() => loadDatabaseEnv({ DATABASE_URL: 'mysql://u:secret-pw@h/db' })).toThrow(
      EnvValidationError,
    );
    try {
      loadDatabaseEnv({ DATABASE_URL: 'mysql://u:secret-pw@h/db' });
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-pw');
    }
  });
});
