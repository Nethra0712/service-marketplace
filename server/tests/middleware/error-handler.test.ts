import express from 'express';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError, ErrorCode } from '../../src/lib/errors.js';
import { parseRequest } from '../../src/lib/validation.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { errorOf } from '../helpers/http.js';

// A minimal app with routes that fail in different ways, so the central error
// handler can be exercised in isolation from any real feature.
function buildApp() {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  app.use(express.json());

  const createWidget = z.object({
    body: z.object({ name: z.string().min(1), quantity: z.number().int().positive() }),
    query: z.object({ dryRun: z.enum(['true', 'false']).optional() }),
  });

  app.post('/widgets', (req, res) => {
    const { body } = parseRequest(createWidget, req);
    res.status(201).json(body);
  });
  app.get('/app-error', () => {
    throw new AppError(409, ErrorCode.BadRequest, 'Widget already exists.');
  });
  app.get('/boom', () => {
    throw new Error('connection to db.internal:5432 failed for user admin');
  });
  app.get('/async-boom', async () => {
    await Promise.reject(new Error('async internal detail'));
  });

  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const app = buildApp();

  it('turns Zod validation failures into 400 with field-level details', async () => {
    const res = await request(app).post('/widgets?dryRun=maybe').send({ name: '', quantity: -1 });

    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    const paths = (errorOf(res).details ?? []).map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.name', 'body.quantity', 'query.dryRun']));
  });

  it('passes valid input through parseRequest with its parsed types', async () => {
    const res = await request(app).post('/widgets').send({ name: 'gear', quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ name: 'gear', quantity: 3 });
  });

  it('returns AppError status, code and message unchanged', async () => {
    const res = await request(app).get('/app-error');

    expect(res.status).toBe(409);
    expect(errorOf(res)).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Widget already exists.',
    });
  });

  it('hides the details of unexpected errors behind a generic 500', async () => {
    for (const route of ['/boom', '/async-boom']) {
      const res = await request(app).get(route);

      expect(res.status).toBe(500);
      expect(errorOf(res)).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      });
      expect(res.text).not.toContain('db.internal');
      expect(res.text).not.toContain('async internal detail');
      expect(errorOf(res).requestId).toEqual(expect.any(String));
    }
  });
});
