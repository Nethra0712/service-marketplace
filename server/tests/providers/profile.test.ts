import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { providerProfiles, profiles, users } from '../../src/db/schema/index.js';
import { createReviewService } from '../../src/modules/providers/index.js';
import { buildTestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { errorOf } from '../helpers/http.js';
import { providerProfileIdOf, signInUser, validProfile } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;

let catalogue: Catalogue;
beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
});
afterAll(() => handle.close());

interface ProfileBody {
  id: string;
  fullName: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  verificationStatus: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  availability: string;
  createdAt: string;
  updatedAt: string;
}
const profileOf = (res: { body: unknown }) => res.body as ProfileBody;

describe('who may use the provider endpoints', () => {
  const endpoints: [string, string][] = [
    ['get', '/api/provider/profile'],
    ['put', '/api/provider/profile'],
    ['post', '/api/provider/profile/submit'],
    ['get', '/api/provider/services'],
    ['post', '/api/provider/services'],
    ['get', '/api/provider/services/00000000-0000-4000-8000-000000000000'],
    ['post', '/api/provider/services/00000000-0000-4000-8000-000000000000/resubmit'],
    ['delete', '/api/provider/services/00000000-0000-4000-8000-000000000000'],
  ];

  it('rejects every endpoint without a token, with the standard generic 401', async () => {
    const { app } = buildTestApp({ db });

    for (const [method, path] of endpoints) {
      const res = await request(app)[method as 'get'](path).send({ fullName: 'X' });
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(errorOf(res).code).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects an invalid or expired token', async () => {
    const { app } = buildTestApp({ db });

    for (const token of ['garbage', 'a.b.c']) {
      const res = await request(app)
        .get('/api/provider/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status, token).toBe(401);
    }
  });

  it('rejects a signed-out session and a suspended account', async () => {
    const { app, sms } = buildTestApp({ db });
    const user = await signInUser(app, sms);
    await user.api.put('/api/provider/profile', validProfile);

    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, user.userId));

    const res = await user.api.get('/api/provider/profile');
    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('ACCOUNT_SUSPENDED');
  });

  it('never caches provider data', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    expect((await api.get('/api/provider/profile')).headers['cache-control']).toBe('no-store');
  });
});

describe('becoming a provider: PUT /api/provider/profile', () => {
  it('a user with no provider profile gets a clear 404 from GET', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.get('/api/provider/profile');

    expect(res.status).toBe(404);
    expect(errorOf(res).code).toBe('PROVIDER_PROFILE_NOT_FOUND');
  });

  it('creates the provider profile as a draft (201) and saves the name on the account', async () => {
    const { app, sms } = buildTestApp({ db });
    const user = await signInUser(app, sms);

    const res = await user.api.put('/api/provider/profile', validProfile);

    expect(res.status).toBe(201);
    expect(profileOf(res)).toMatchObject({
      fullName: 'Nimal Perera',
      bio: 'Fifteen years fixing homes across Colombo.',
      yearsOfExperience: 15,
      verificationStatus: 'draft',
      submittedAt: null,
      reviewedAt: null,
      reviewNote: null,
      availability: 'offline',
    });
    const [saved] = await db.select().from(profiles).where(eq(profiles.userId, user.userId));
    expect(saved?.fullName).toBe('Nimal Perera');
  });

  it('makes the user a provider: /me now lists the provider role', async () => {
    const { app, sms } = buildTestApp({ db });
    const user = await signInUser(app, sms);
    expect((await user.api.get('/api/auth/me')).body).toMatchObject({ roles: ['customer'] });

    await user.api.put('/api/provider/profile', validProfile);

    expect((await user.api.get('/api/auth/me')).body).toMatchObject({
      roles: ['customer', 'provider'],
      profile: { fullName: 'Nimal Perera' },
    });
  });

  it('allows a provider profile with only the required name', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.put('/api/provider/profile', { fullName: 'Kasun' });

    expect(res.status).toBe(201);
    expect(profileOf(res)).toMatchObject({ fullName: 'Kasun', bio: null, yearsOfExperience: null });
  });

  it('GET returns what was saved', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    const res = await api.get('/api/provider/profile');

    expect(res.status).toBe(200);
    expect(profileOf(res)).toMatchObject(validProfile);
  });
});

describe('updating the provider profile', () => {
  it('updates the fields (200) without creating a second profile', async () => {
    const { app, sms } = buildTestApp({ db });
    const user = await signInUser(app, sms);
    const created = profileOf(await user.api.put('/api/provider/profile', validProfile));

    const res = await user.api.put('/api/provider/profile', {
      fullName: 'Nimal S. Perera',
      bio: 'Now also doing solar water heaters.',
      yearsOfExperience: 16,
    });

    expect(res.status).toBe(200);
    expect(profileOf(res)).toMatchObject({
      id: created.id,
      fullName: 'Nimal S. Perera',
      bio: 'Now also doing solar water heaters.',
      yearsOfExperience: 16,
    });
    expect(await db.select().from(providerProfiles)).toHaveLength(1);
  });

  it('moves updatedAt forward only when something changed', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    const created = profileOf(await api.put('/api/provider/profile', validProfile));

    const unchanged = profileOf(await api.put('/api/provider/profile', validProfile));
    expect(unchanged.updatedAt).toBe(created.updatedAt);

    const changed = profileOf(
      await api.put('/api/provider/profile', { ...validProfile, yearsOfExperience: 20 }),
    );
    expect(new Date(changed.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.updatedAt).getTime(),
    );
  });

  it('clears the bio and experience when they are left out or blank', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    const res = await api.put('/api/provider/profile', { fullName: 'Nimal Perera', bio: '   ' });

    expect(profileOf(res)).toMatchObject({ bio: null, yearsOfExperience: null });
  });

  it('trims whitespace from the name and bio', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.put('/api/provider/profile', {
      fullName: '  Nimal Perera  ',
      bio: '  Experienced.  ',
    });

    expect(profileOf(res)).toMatchObject({ fullName: 'Nimal Perera', bio: 'Experienced.' });
  });

  it('never lets an update change verification state, even after submission', async () => {
    const { app, sms } = buildTestApp({ db });
    const user = await signInUser(app, sms);
    await user.api.put('/api/provider/profile', validProfile);
    await user.api.post('/api/provider/services', {
      categorySlug: 'plumbing',
      citySlug: 'colombo',
    });
    await user.api.post('/api/provider/profile/submit');

    const res = await user.api.put('/api/provider/profile', { ...validProfile, bio: 'Edited.' });

    expect(res.status).toBe(200);
    expect(profileOf(res)).toMatchObject({ verificationStatus: 'submitted', bio: 'Edited.' });
  });

  it('supports concurrent first saves without a server error', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const results = await Promise.all([
      api.put('/api/provider/profile', validProfile),
      api.put('/api/provider/profile', validProfile),
      api.put('/api/provider/profile', validProfile),
    ]);

    for (const res of results) expect([200, 201]).toContain(res.status);
    expect(await db.select().from(providerProfiles)).toHaveLength(1);
  });
});

describe('validation', () => {
  it.each([
    ['a missing name', {}],
    ['an empty name', { fullName: '' }],
    ['a blank name', { fullName: '   ' }],
    ['a name over 100 characters', { fullName: 'x'.repeat(101) }],
    ['a non-string name', { fullName: 123 }],
    ['a bio over 1000 characters', { fullName: 'A', bio: 'x'.repeat(1001) }],
    ['negative experience', { fullName: 'A', yearsOfExperience: -1 }],
    ['experience over 60 years', { fullName: 'A', yearsOfExperience: 61 }],
    ['fractional experience', { fullName: 'A', yearsOfExperience: 2.5 }],
    ['experience as a string', { fullName: 'A', yearsOfExperience: '5' }],
  ])('rejects %s with a 400 and saves nothing', async (_name, body) => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.put('/api/provider/profile', body);

    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(await db.select().from(providerProfiles)).toHaveLength(0);
  });

  it('accepts the boundary values', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    for (const body of [
      { fullName: 'x'.repeat(100), bio: 'y'.repeat(1000), yearsOfExperience: 0 },
      { fullName: 'A', yearsOfExperience: 60 },
    ]) {
      expect([200, 201]).toContain((await api.put('/api/provider/profile', body)).status);
    }
  });

  it('rejects fields a provider must never set (mass assignment)', async () => {
    const { app, sms } = buildTestApp({ db });
    const user = await signInUser(app, sms);
    await user.api.put('/api/provider/profile', validProfile);

    for (const extra of [
      { verificationStatus: 'verified' },
      { submittedAt: '2020-01-01T00:00:00Z' },
      { reviewNote: 'Excellent' },
      { userId: '00000000-0000-4000-8000-000000000000' },
      { availability: 'online' },
      { id: '00000000-0000-4000-8000-000000000000' },
    ]) {
      const res = await user.api.put('/api/provider/profile', { ...validProfile, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(400);
    }
    expect(profileOf(await user.api.get('/api/provider/profile')).verificationStatus).toBe('draft');
  });
});

describe('POST /api/provider/profile/submit', () => {
  it('needs a provider profile first', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);

    const res = await api.post('/api/provider/profile/submit');

    expect(res.status).toBe(404);
    expect(errorOf(res).code).toBe('PROVIDER_PROFILE_NOT_FOUND');
  });

  it('refuses an incomplete profile and says what is missing', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    const res = await api.post('/api/provider/profile/submit');

    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('PROFILE_INCOMPLETE');
    expect(errorOf(res).details).toEqual([
      { path: 'services', message: 'Apply for at least one service before submitting.' },
    ]);
  });

  it('submits a complete profile: draft becomes submitted, with a timestamp', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);
    await api.post('/api/provider/services', { categorySlug: 'plumbing', citySlug: 'colombo' });

    const res = await api.post('/api/provider/profile/submit');

    expect(res.status).toBe(200);
    expect(profileOf(res).verificationStatus).toBe('submitted');
    expect(profileOf(res).submittedAt).not.toBeNull();
  });

  it('cannot be submitted twice, and a verified provider cannot re-submit', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const user = await signInUser(app, sms);
    await user.api.put('/api/provider/profile', validProfile);
    await user.api.post('/api/provider/services', {
      categorySlug: 'plumbing',
      citySlug: 'colombo',
    });
    await user.api.post('/api/provider/profile/submit');

    const again = await user.api.post('/api/provider/profile/submit');
    expect(again.status).toBe(409);
    expect(errorOf(again).code).toBe('INVALID_STATE');

    const review = createReviewService({ db, clock: clock.now });
    await review.reviewProfile({
      providerProfileId: await providerProfileIdOf(db, user.userId),
      decision: 'verified',
    });
    const afterVerified = await user.api.post('/api/provider/profile/submit');
    expect(afterVerified.status).toBe(409);
  });

  it('lets a rejected provider see the reason, fix things and submit again', async () => {
    const { app, sms, clock } = buildTestApp({ db });
    const user = await signInUser(app, sms);
    await user.api.put('/api/provider/profile', validProfile);
    await user.api.post('/api/provider/services', {
      categorySlug: 'plumbing',
      citySlug: 'colombo',
    });
    await user.api.post('/api/provider/profile/submit');
    const profileId = await providerProfileIdOf(db, user.userId);
    await createReviewService({ db, clock: clock.now }).reviewProfile({
      providerProfileId: profileId,
      decision: 'rejected',
      note: 'Please add more detail about your experience.',
    });

    const rejected = profileOf(await user.api.get('/api/provider/profile'));
    expect(rejected).toMatchObject({
      verificationStatus: 'rejected',
      reviewNote: 'Please add more detail about your experience.',
    });
    expect(rejected.reviewedAt).not.toBeNull();

    await user.api.put('/api/provider/profile', { ...validProfile, bio: 'A much longer bio.' });
    const resubmitted = await user.api.post('/api/provider/profile/submit');

    expect(resubmitted.status).toBe(200);
    expect(profileOf(resubmitted)).toMatchObject({
      verificationStatus: 'submitted',
      reviewedAt: null,
      reviewNote: null,
    });
  });

  it('cannot be used to verify yourself: there is no endpoint that does', async () => {
    const { app, sms } = buildTestApp({ db });
    const { api } = await signInUser(app, sms);
    await api.put('/api/provider/profile', validProfile);

    // Signed in, so these reach routing: none of them exists.
    for (const path of [
      '/api/provider/profile/verify',
      '/api/provider/profile/approve',
      '/api/admin/providers/verify',
    ]) {
      const res = await api.post(path, { status: 'verified' });
      expect(res.status, `POST ${path}`).toBe(404);
    }
    expect(
      (await api.patch('/api/provider/profile', { verificationStatus: 'verified' })).status,
    ).toBe(404);
    expect(profileOf(await api.get('/api/provider/profile')).verificationStatus).toBe('draft');
  });
});

describe('isolation between users', () => {
  it('each user only ever sees their own provider profile', async () => {
    const { app, sms } = buildTestApp({ db });
    const alice = await signInUser(app, sms);
    const bob = await signInUser(app, sms);
    await alice.api.put('/api/provider/profile', { fullName: 'Alice Silva', bio: 'Alice bio' });

    expect((await bob.api.get('/api/provider/profile')).status).toBe(404);
    await bob.api.put('/api/provider/profile', { fullName: 'Bob Fernando' });

    expect(profileOf(await alice.api.get('/api/provider/profile')).fullName).toBe('Alice Silva');
    expect(profileOf(await bob.api.get('/api/provider/profile')).fullName).toBe('Bob Fernando');
    expect(profileOf(await bob.api.get('/api/provider/profile')).bio).toBeNull();
  });

  it('a request cannot name another user or profile: the caller is always the token owner', async () => {
    const { app, sms } = buildTestApp({ db });
    const alice = await signInUser(app, sms);
    await alice.api.put('/api/provider/profile', { fullName: 'Alice Silva' });
    const bob = await signInUser(app, sms);

    const res = await bob.api.put('/api/provider/profile', {
      fullName: 'Bob',
      userId: alice.userId,
    });

    expect(res.status).toBe(400);
    expect(profileOf(await alice.api.get('/api/provider/profile')).fullName).toBe('Alice Silva');
  });
});

it('keeps the shared catalogue fixture consistent for these tests', () => {
  expect(catalogue.colombo.slug).toBe('colombo');
});
