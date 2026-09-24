import request from 'supertest';
import { beforeEach, describe, expect, it, afterAll } from 'vitest';

import { buildTestApp, type TestApp } from '../helpers/app.js';
import { errorOf } from '../helpers/bookings.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { signInUser } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;
afterAll(() => handle.close());

let t: TestApp;
beforeEach(async () => {
  await resetDatabase(db);
  t = buildTestApp({ db });
});

describe('POST /api/notifications/tokens', () => {
  it('requires authentication', async () => {
    const res = await request(t.app).post('/api/notifications/tokens').send({
      token: 'tok-1',
      platform: 'android',
    });
    expect(res.status).toBe(401);
  });

  it('registers a token', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.post('/api/notifications/tokens', {
      token: 'tok-1',
      platform: 'android',
    });
    expect(res.status).toBe(204);
  });

  it('rejects a blank token', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.post('/api/notifications/tokens', {
      token: '',
      platform: 'android',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown platform', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.post('/api/notifications/tokens', {
      token: 'tok-1',
      platform: 'windows',
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/notifications/tokens', () => {
  it('requires authentication', async () => {
    const res = await request(t.app).delete('/api/notifications/tokens').send({ token: 'tok-1' });
    expect(res.status).toBe(401);
  });

  it("removes the caller's own token", async () => {
    const { api } = await signInUser(t.app, t.sms);
    await api.post('/api/notifications/tokens', { token: 'tok-1', platform: 'android' });
    const res = await api.del('/api/notifications/tokens').send({ token: 'tok-1' });
    expect(res.status).toBe(204);
  });

  it('authorization: refuses to remove a token owned by someone else', async () => {
    const { api: owner } = await signInUser(t.app, t.sms);
    await owner.post('/api/notifications/tokens', { token: 'tok-1', platform: 'android' });
    const { api: stranger } = await signInUser(t.app, t.sms);

    const res = await stranger.del('/api/notifications/tokens').send({ token: 'tok-1' });
    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('DEVICE_TOKEN_NOT_OWNED');
  });

  it('is idempotent for a token that was never registered', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.del('/api/notifications/tokens').send({ token: 'never-registered' });
    expect(res.status).toBe(204);
  });
});

describe('preferences', () => {
  it('defaults to push enabled', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.get('/api/notifications/preferences');
    expect(res.body).toEqual({ pushEnabled: true });
  });

  it('can be turned off and read back', async () => {
    const { api } = await signInUser(t.app, t.sms);
    await api.put('/api/notifications/preferences', { pushEnabled: false });
    const res = await api.get('/api/notifications/preferences');
    expect(res.body).toEqual({ pushEnabled: false });
  });
});

describe('GET /api/notifications', () => {
  it('requires authentication', async () => {
    const res = await request(t.app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('starts empty', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.get('/api/notifications');
    expect(res.body).toEqual({ items: [], unreadCount: 0 });
  });
});

describe('POST /api/notifications/:id/read and /read-all', () => {
  it('read-all requires authentication', async () => {
    const res = await request(t.app).post('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });

  it('/:id/read 404s for an id that does not exist', async () => {
    const { api } = await signInUser(t.app, t.sms);
    const res = await api.post('/api/notifications/00000000-0000-4000-8000-000000000000/read');
    expect(res.status).toBe(404);
  });
});
