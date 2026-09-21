import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { buildTestApp } from '../helpers/app.js';
import { createTestDatabase } from '../helpers/database.js';
import { errorOf } from '../helpers/http.js';

const database = createTestDatabase();
const { db } = database;

afterAll(async () => {
  await database.close();
});

describe('GET /api/health', () => {
  it('reports the process is up without touching the database', async () => {
    const pingDatabase = vi.fn().mockRejectedValue(new Error('must not be called'));
    const { app } = buildTestApp({ db, pingDatabase });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect((res.body as { uptimeSeconds: unknown }).uptimeSeconds).toEqual(expect.any(Number));
    expect(pingDatabase).not.toHaveBeenCalled();
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('GET /api/health/db', () => {
  it('connects to the real PostgreSQL database', async () => {
    const { app } = buildTestApp({ db, pingDatabase: database.ping });

    const res = await request(app).get('/api/health/db');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('returns 503 with a generic message, and no internals, when the database fails', async () => {
    const pingDatabase = vi
      .fn()
      .mockRejectedValue(
        new Error('connect ECONNREFUSED 10.0.0.5:5432 password authentication failed hunter2'),
      );
    const { app } = buildTestApp({ db, pingDatabase });

    const res = await request(app).get('/api/health/db');

    expect(res.status).toBe(503);
    expect(errorOf(res)).toMatchObject({
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database is unavailable.',
    });
    expect(res.text).not.toContain('hunter2');
    expect(res.text).not.toContain('10.0.0.5');
  });
});

describe('request handling foundation', () => {
  const { app } = buildTestApp({ db });

  it('answers unknown routes with the standard 404 error body', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(errorOf(res)).toMatchObject({ code: 'NOT_FOUND', message: 'Resource not found.' });
    expect(errorOf(res).requestId).toBe(res.headers['x-request-id']);
  });

  it('rejects malformed JSON with 400 INVALID_JSON and does not echo the input', async () => {
    const res = await request(app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send('{"leak": "sensitive-value",');

    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('INVALID_JSON');
    expect(res.text).not.toContain('sensitive-value');
  });

  it('rejects bodies over the size limit with 413', async () => {
    const res = await request(app)
      .post('/api/anything')
      .send({ blob: 'x'.repeat(200 * 1024) });

    expect(res.status).toBe(413);
    expect(errorOf(res).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('echoes a safe caller-supplied request id and replaces an unsafe one', async () => {
    const safe = await request(app).get('/api/health').set('X-Request-Id', 'trace-1234abcd');
    expect(safe.headers['x-request-id']).toBe('trace-1234abcd');

    const unsafe = await request(app).get('/api/health').set('X-Request-Id', 'bad id\twith spaces');
    expect(unsafe.headers['x-request-id']).not.toBe('bad id\twith spaces');
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('CORS', () => {
  const appWithOrigins = (corsOrigins: string[]) =>
    buildTestApp({ db, config: { corsOrigins } }).app;

  it('grants no cross-origin access by default', async () => {
    const res = await request(appWithOrigins([]))
      .get('/api/health')
      .set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows only configured origins', async () => {
    const app = appWithOrigins(['https://admin.example.com']);

    const allowed = await request(app)
      .get('/api/health')
      .set('Origin', 'https://admin.example.com');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://admin.example.com');

    const denied = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
