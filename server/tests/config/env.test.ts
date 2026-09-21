import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'dotenv';
import { describe, expect, it } from 'vitest';

import { EnvValidationError, loadEnv } from '../../src/config/env.js';

const validEnv = { DATABASE_URL: 'postgresql://user:secret-pw@localhost:5432/app' };

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
  it('applies defaults when only DATABASE_URL is provided', () => {
    expect(loadEnv(validEnv)).toEqual({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: validEnv.DATABASE_URL,
      corsOrigins: [],
      logLevel: 'info',
    });
  });

  it('parses explicit values, coercing PORT from a string', () => {
    const config = loadEnv({
      ...validEnv,
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: 'https://admin.example.com, http://localhost:3001',
    });
    expect(config).toMatchObject({
      nodeEnv: 'production',
      port: 8080,
      logLevel: 'warn',
      corsOrigins: ['https://admin.example.com', 'http://localhost:3001'],
    });
  });

  it('requires DATABASE_URL', () => {
    expect(problemsFor({})).toContain('DATABASE_URL');
  });

  it('rejects a DATABASE_URL that is not a postgres URL', () => {
    expect(problemsFor({ DATABASE_URL: 'mysql://u:p@localhost/db' })).toContain('DATABASE_URL');
    expect(problemsFor({ DATABASE_URL: 'not a url' })).toContain('DATABASE_URL');
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
    expect(message).toContain('PORT');
    expect(message).toContain('LOG_LEVEL');
  });

  it('never includes credential values in error messages', () => {
    const message = problemsFor({ DATABASE_URL: 'mysql://user:secret-pw@localhost/db' });
    expect(message).not.toContain('secret-pw');
  });

  it('accepts the committed .env.example template', () => {
    const template = parse(readFileSync(path.resolve(import.meta.dirname, '../../.env.example')));
    expect(() => loadEnv(template)).not.toThrow();
  });
});
