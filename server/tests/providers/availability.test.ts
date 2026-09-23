import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { providerProfiles } from '../../src/db/schema/index.js';
import { buildTestApp } from '../helpers/app.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { errorOf } from '../helpers/http.js';
import { apiFor, signInUser, validProfile } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(async () => {
  await resetDatabase(db);
});
afterAll(() => handle.close());

describe('PUT /api/provider/profile/availability', () => {
  it('requires authentication', async () => {
    const { app } = buildTestApp({ db });
    const res = await apiFor(app).put('/api/provider/profile/availability', {
      availability: 'online',
    });
    expect(res.status).toBe(401);
  });

  it('requires an existing provider profile', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.put('/api/provider/profile/availability', { availability: 'online' });
    expect(res.status).toBe(404);
    expect(errorOf(res).code).toBe('PROVIDER_PROFILE_NOT_FOUND');
  });

  it('toggles online and back to offline', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    const online = await api.put('/api/provider/profile/availability', { availability: 'online' });
    expect(online.status).toBe(200);
    expect((online.body as { availability: string }).availability).toBe('online');

    const offline = await api.put('/api/provider/profile/availability', {
      availability: 'offline',
    });
    expect((offline.body as { availability: string }).availability).toBe('offline');
  });

  it('rejects an invalid availability value', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    const res = await api.put('/api/provider/profile/availability', { availability: 'busy' });
    expect(res.status).toBe(400);
  });

  it('rejects fields the client has no business setting', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    const res = await api.put('/api/provider/profile/availability', {
      availability: 'online',
      verificationStatus: 'verified',
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/provider/profile/location', () => {
  it('requires authentication', async () => {
    const { app } = buildTestApp({ db });
    const res = await apiFor(app).put('/api/provider/profile/location', {
      latitude: 6.9271,
      longitude: 79.8612,
    });
    expect(res.status).toBe(401);
  });

  it('requires an existing provider profile', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.put('/api/provider/profile/location', {
      latitude: 6.9271,
      longitude: 79.8612,
    });
    expect(res.status).toBe(404);
    expect(errorOf(res).code).toBe('PROVIDER_PROFILE_NOT_FOUND');
  });

  it('records the reported location, overwriting the previous one', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api, userId } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    const res = await api.put('/api/provider/profile/location', {
      latitude: 6.9271,
      longitude: 79.8612,
    });
    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId));
    expect(row?.lastLatitude).toBe('6.927100');
    expect(row?.lastLongitude).toBe('79.861200');
    expect(row?.lastLocationAt).toBeInstanceOf(Date);

    await api.put('/api/provider/profile/location', { latitude: 7.2906, longitude: 80.6337 });
    const [updated] = await db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId));
    expect(updated?.lastLatitude).toBe('7.290600');
    expect(updated?.lastLongitude).toBe('80.633700');
  });

  it('rejects an out-of-range latitude or longitude', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    expect(
      (await api.put('/api/provider/profile/location', { latitude: 91, longitude: 0 })).status,
    ).toBe(400);
    expect(
      (await api.put('/api/provider/profile/location', { latitude: 0, longitude: 181 })).status,
    ).toBe(400);
  });

  it('rejects a missing coordinate', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    const res = await api.put('/api/provider/profile/location', { latitude: 6.9271 });
    expect(res.status).toBe(400);
  });
});
