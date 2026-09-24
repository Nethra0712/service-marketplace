import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { providerServices } from '../../src/db/schema/index.js';
import { createReviewService } from '../../src/modules/providers/index.js';
import { buildTestApp } from '../helpers/app.js';
import {
  addKandy,
  createCatalogue,
  setCategoryActive,
  setCityActive,
  type Catalogue,
} from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { errorOf } from '../helpers/http.js';
import { signInUser, validProfile, type Api } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;

let catalogue: Catalogue;
beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
});
afterAll(() => handle.close());

interface ApplicationBody {
  id: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  category: { id: string; slug: string; name: string; pricingModel: string };
  city: { slug: string; name: string };
  createdAt: string;
  updatedAt: string;
}
const appOf = (res: { body: unknown }) => res.body as ApplicationBody;
const listOf = (res: { body: unknown }) => (res.body as { items: ApplicationBody[] }).items;

/** A signed-in provider with a profile, plus a way to act as their reviewer. */
async function newProvider(ctx: ReturnType<typeof buildTestApp>) {
  const user = await signInUser(ctx.app, ctx.sms);
  await user.api.put('/api/provider/profile', validProfile);
  const review = createReviewService({ db, clock: ctx.clock.now });
  return { ...user, review };
}

const apply = (api: Api, categorySlug: string, citySlug = 'colombo', query = '') =>
  api.post(`/api/provider/services${query}`, { categorySlug, citySlug });

describe('applying for a category: POST /api/provider/services', () => {
  it('needs a provider profile first', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await signInUser(ctx.app, ctx.sms);

    const res = await apply(api, 'plumbing');

    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('PROVIDER_PROFILE_REQUIRED');
    expect(await db.select().from(providerServices)).toHaveLength(0);
  });

  it('creates a pending application for the category and city (201)', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    const res = await apply(api, 'plumbing');

    expect(res.status).toBe(201);
    expect(appOf(res)).toMatchObject({
      status: 'pending',
      reviewNote: null,
      reviewedAt: null,
      category: { slug: 'plumbing', name: 'Plumbing', pricingModel: 'quote' },
      city: { slug: 'colombo', name: 'Colombo' },
    });
  });

  it('applies in the provider’s language', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    const res = await apply(api, 'plumbing', 'colombo', '?lang=si');

    expect(appOf(res).category.name).toBe('ජලනල කටයුතු');
  });

  it('lets a provider apply for several categories, independently', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    for (const slug of ['plumbing', 'electrical', 'cleaning']) {
      expect((await apply(api, slug)).status, slug).toBe(201);
    }

    const list = listOf(await api.get('/api/provider/services'));
    expect(list.map((a) => a.category.slug).sort()).toEqual(['cleaning', 'electrical', 'plumbing']);
    expect(list.every((a) => a.status === 'pending')).toBe(true);
  });

  it('lets the same category be applied for in different cities', async () => {
    await addKandy(db, catalogue);
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    expect((await apply(api, 'plumbing', 'colombo')).status).toBe(201);
    expect((await apply(api, 'plumbing', 'kandy')).status).toBe(201);
  });

  it('lets many providers apply for the same category', async () => {
    const ctx = buildTestApp({ db });
    const a = await newProvider(ctx);
    const b = await newProvider(ctx);

    expect((await apply(a.api, 'plumbing')).status).toBe(201);
    expect((await apply(b.api, 'plumbing')).status).toBe(201);
    expect(await db.select().from(providerServices)).toHaveLength(2);
  });
});

describe('duplicate applications', () => {
  it('rejects a second application for the same category and city with 409', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);
    await apply(api, 'plumbing');

    const res = await apply(api, 'plumbing');

    expect(res.status).toBe(409);
    expect(errorOf(res).code).toBe('ALREADY_APPLIED');
    expect(await db.select().from(providerServices)).toHaveLength(1);
  });

  it('is rejected whatever state the first application is in', async () => {
    const ctx = buildTestApp({ db });
    const { api, review } = await newProvider(ctx);
    const first = appOf(await apply(api, 'plumbing'));

    for (const decision of ['approved', 'suspended'] as const) {
      await review.reviewApplication({ applicationId: first.id, decision });
      expect((await apply(api, 'plumbing')).status, decision).toBe(409);
    }
  });

  it('lets exactly one of several simultaneous identical applications through, with no 500s', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    const results = await Promise.all(Array.from({ length: 5 }, () => apply(api, 'plumbing')));

    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await db.select().from(providerServices)).toHaveLength(1);
  });
});

describe('what can be applied for', () => {
  it.each([
    ['an inactive category', 'carpentry', 'colombo'],
    ['a category no city offers', 'painting', 'colombo'],
    ['a category that does not exist', 'no-such-thing', 'colombo'],
    ['a city that does not exist', 'plumbing', 'galle'],
  ])('rejects %s with 404', async (_name, category, city) => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    const res = await apply(api, category, city);

    expect(res.status).toBe(404);
    expect(await db.select().from(providerServices)).toHaveLength(0);
  });

  it('rejects a category that this city does not offer, even though another city does', async () => {
    await addKandy(db, catalogue);
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    // Kandy offers only plumbing.
    expect((await apply(api, 'electrical', 'kandy')).status).toBe(404);
    expect((await apply(api, 'plumbing', 'kandy')).status).toBe(201);
  });

  it('stops accepting applications once the category or the city is switched off', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    await setCategoryActive(db, catalogue.plumbing.id, false);
    expect((await apply(api, 'plumbing')).status).toBe(404);
    await setCategoryActive(db, catalogue.plumbing.id, true);

    await setCityActive(db, catalogue.colombo.id, false);
    expect((await apply(api, 'plumbing')).status).toBe(404);
  });

  it.each([
    ['a missing city', { categorySlug: 'plumbing' }],
    ['a missing category', { citySlug: 'colombo' }],
    ['a malformed slug', { categorySlug: 'Not A Slug', citySlug: 'colombo' }],
    ['a non-string slug', { categorySlug: 123, citySlug: 'colombo' }],
    ['an overlong slug', { categorySlug: 'x'.repeat(65), citySlug: 'colombo' }],
    [
      'a status the provider must not set',
      { categorySlug: 'plumbing', citySlug: 'colombo', status: 'approved' },
    ],
    [
      'ids in place of slugs',
      {
        serviceCategoryId: '00000000-0000-4000-8000-000000000000',
        cityId: '00000000-0000-4000-8000-000000000000',
      },
    ],
  ])('rejects %s with 400', async (_name, body) => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    const res = await api.post('/api/provider/services', body);

    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(await db.select().from(providerServices)).toHaveLength(0);
  });
});

describe('seeing my applications and their status', () => {
  it('lists only my own applications, newest first', async () => {
    const ctx = buildTestApp({ db });
    const alice = await newProvider(ctx);
    const bob = await newProvider(ctx);
    await apply(alice.api, 'plumbing');
    await apply(alice.api, 'cleaning');
    await apply(bob.api, 'electrical');

    const aliceList = listOf(await alice.api.get('/api/provider/services'));
    const bobList = listOf(await bob.api.get('/api/provider/services'));

    expect(aliceList.map((a) => a.category.slug)).toEqual(['cleaning', 'plumbing']);
    expect(bobList.map((a) => a.category.slug)).toEqual(['electrical']);
  });

  it('returns an empty list for a provider with no applications', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    const res = await api.get('/api/provider/services');

    expect(res.status).toBe(200);
    expect(listOf(res)).toEqual([]);
  });

  it('a user with no provider profile is told so, not shown an empty list', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await signInUser(ctx.app, ctx.sms);

    const res = await api.get('/api/provider/services');

    expect(res.status).toBe(404);
    expect(errorOf(res).code).toBe('PROVIDER_PROFILE_NOT_FOUND');
  });

  it('shows the status each category has reached, independently per category', async () => {
    const ctx = buildTestApp({ db });
    const { api, review } = await newProvider(ctx);
    const plumbing = appOf(await apply(api, 'plumbing'));
    const electrical = appOf(await apply(api, 'electrical'));
    const cleaning = appOf(await apply(api, 'cleaning'));
    await review.reviewApplication({ applicationId: plumbing.id, decision: 'approved' });
    await review.reviewApplication({
      applicationId: electrical.id,
      decision: 'rejected',
      note: 'Please upload your certificate.',
    });
    await review.reviewApplication({ applicationId: cleaning.id, decision: 'approved' });
    await review.reviewApplication({
      applicationId: cleaning.id,
      decision: 'suspended',
      note: 'Under review after a complaint.',
    });

    const byCategory = Object.fromEntries(
      listOf(await api.get('/api/provider/services')).map((a) => [a.category.slug, a]),
    );

    expect(byCategory.plumbing).toMatchObject({ status: 'approved', reviewNote: null });
    expect(byCategory.plumbing?.reviewedAt).not.toBeNull();
    expect(byCategory.electrical).toMatchObject({
      status: 'rejected',
      reviewNote: 'Please upload your certificate.',
    });
    expect(byCategory.cleaning).toMatchObject({
      status: 'suspended',
      reviewNote: 'Under review after a complaint.',
    });
  });

  it('shows one application by id, and only to its owner', async () => {
    const ctx = buildTestApp({ db });
    const alice = await newProvider(ctx);
    const bob = await newProvider(ctx);
    const created = appOf(await apply(alice.api, 'plumbing'));

    const mine = await alice.api.get(`/api/provider/services/${created.id}`);
    const theirs = await bob.api.get(`/api/provider/services/${created.id}`);

    expect(mine.status).toBe(200);
    expect(appOf(mine).id).toBe(created.id);
    // Someone else's application looks exactly like one that does not exist.
    expect(theirs.status).toBe(404);
    expect(errorOf(theirs).message).toBe('Application not found.');
    const unknown = await alice.api.get(
      '/api/provider/services/00000000-0000-4000-8000-000000000000',
    );
    expect(errorOf(unknown)).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Application not found.',
    });
  });

  it('rejects a malformed application id with 400', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    expect((await api.get('/api/provider/services/not-a-uuid')).status).toBe(400);
    expect((await api.del('/api/provider/services/not-a-uuid')).status).toBe(400);
  });

  it('still shows an application after its category was deactivated', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);
    await apply(api, 'plumbing');
    await setCategoryActive(db, catalogue.plumbing.id, false);

    expect(listOf(await api.get('/api/provider/services'))).toHaveLength(1);
  });
});

describe('a provider can never approve themselves', () => {
  it('has no way to set or change a status', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);
    const created = appOf(await apply(api, 'plumbing'));

    const attempts = [
      api.put(`/api/provider/services/${created.id}`, { status: 'approved' }),
      api.patch(`/api/provider/services/${created.id}`, { status: 'approved' }),
      api.post(`/api/provider/services/${created.id}/approve`, {}),
      api.post(`/api/provider/services/${created.id}/status`, { status: 'approved' }),
      api.post('/api/provider/services', {
        categorySlug: 'electrical',
        citySlug: 'colombo',
        status: 'approved',
      }),
    ];
    for (const attempt of await Promise.all(attempts)) {
      expect([400, 404]).toContain(attempt.status);
    }

    expect(appOf(await api.get(`/api/provider/services/${created.id}`)).status).toBe('pending');
  });

  it('exposes no customer/provider-facing reviewer endpoints, and the real admin ones reject a non-admin caller', async () => {
    const ctx = buildTestApp({ db });
    const { api } = await newProvider(ctx);

    // Not real paths anywhere in the app.
    for (const path of ['/api/providers/review', '/api/provider/review']) {
      expect((await api.get(path)).status, path).toBe(404);
      expect((await api.post(path, { status: 'approved' })).status, path).toBe(404);
    }

    // Real admin paths, correctly unreachable with a mobile session
    // (no admin cookie): the mobile app's own Bearer token carries no
    // weight here — see `require-admin-auth.ts`.
    for (const path of ['/api/admin/providers', '/api/admin/provider-services']) {
      expect((await api.get(path)).status, path).toBe(401);
      expect((await api.post(path, { status: 'approved' })).status, path).toBe(401);
    }
  });
});

describe('re-applying after a rejection', () => {
  it('moves a rejected application back to pending and clears the reviewer’s note', async () => {
    const ctx = buildTestApp({ db });
    const { api, review } = await newProvider(ctx);
    const created = appOf(await apply(api, 'plumbing'));
    await review.reviewApplication({
      applicationId: created.id,
      decision: 'rejected',
      note: 'Not enough experience.',
    });

    const res = await api.post(`/api/provider/services/${created.id}/resubmit`);

    expect(res.status).toBe(200);
    expect(appOf(res)).toMatchObject({
      id: created.id,
      status: 'pending',
      reviewNote: null,
      reviewedAt: null,
    });
  });

  it.each(['pending', 'approved', 'suspended'] as const)(
    'refuses to re-open an application that is %s',
    async (state) => {
      const ctx = buildTestApp({ db });
      const { api, review } = await newProvider(ctx);
      const created = appOf(await apply(api, 'plumbing'));
      if (state !== 'pending') {
        await review.reviewApplication({ applicationId: created.id, decision: 'approved' });
      }
      if (state === 'suspended') {
        await review.reviewApplication({ applicationId: created.id, decision: 'suspended' });
      }

      const res = await api.post(`/api/provider/services/${created.id}/resubmit`);

      expect(res.status).toBe(409);
      expect(errorOf(res).code).toBe('INVALID_STATE');
    },
  );

  it('cannot re-open someone else’s application', async () => {
    const ctx = buildTestApp({ db });
    const alice = await newProvider(ctx);
    const bob = await newProvider(ctx);
    const created = appOf(await apply(alice.api, 'plumbing'));
    await alice.review.reviewApplication({ applicationId: created.id, decision: 'rejected' });

    const res = await bob.api.post(`/api/provider/services/${created.id}/resubmit`);

    expect(res.status).toBe(404);
    const [row] = await db
      .select()
      .from(providerServices)
      .where(eq(providerServices.id, created.id));
    expect(row?.status).toBe('rejected');
  });
});

describe('withdrawing an application', () => {
  it.each(['pending', 'rejected'] as const)('removes a %s application (204)', async (state) => {
    const ctx = buildTestApp({ db });
    const { api, review } = await newProvider(ctx);
    const created = appOf(await apply(api, 'plumbing'));
    if (state === 'rejected') {
      await review.reviewApplication({ applicationId: created.id, decision: 'rejected' });
    }

    const res = await api.del(`/api/provider/services/${created.id}`);

    expect(res.status).toBe(204);
    expect(listOf(await api.get('/api/provider/services'))).toEqual([]);
    // And the provider may apply again afterwards.
    expect((await apply(api, 'plumbing')).status).toBe(201);
  });

  it.each(['approved', 'suspended'] as const)(
    'keeps an %s application on record (409)',
    async (state) => {
      const ctx = buildTestApp({ db });
      const { api, review } = await newProvider(ctx);
      const created = appOf(await apply(api, 'plumbing'));
      await review.reviewApplication({ applicationId: created.id, decision: 'approved' });
      if (state === 'suspended') {
        await review.reviewApplication({ applicationId: created.id, decision: 'suspended' });
      }

      const res = await api.del(`/api/provider/services/${created.id}`);

      expect(res.status).toBe(409);
      expect(errorOf(res).code).toBe('INVALID_STATE');
      expect(listOf(await api.get('/api/provider/services'))).toHaveLength(1);
    },
  );

  it('cannot withdraw someone else’s application, or one that does not exist', async () => {
    const ctx = buildTestApp({ db });
    const alice = await newProvider(ctx);
    const bob = await newProvider(ctx);
    const created = appOf(await apply(alice.api, 'plumbing'));

    expect((await bob.api.del(`/api/provider/services/${created.id}`)).status).toBe(404);
    expect(
      (await alice.api.del('/api/provider/services/00000000-0000-4000-8000-000000000000')).status,
    ).toBe(404);
    expect(listOf(await alice.api.get('/api/provider/services'))).toHaveLength(1);
  });
});
