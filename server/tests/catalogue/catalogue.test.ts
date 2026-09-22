import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { cityCategories } from '../../src/db/schema/index.js';
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

const handle = createTestDatabase();
const { db } = handle;

let catalogue: Catalogue;
beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
});
afterAll(() => handle.close());

interface CategoryItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  pricingModel: string;
}
const itemsOf = (res: { body: unknown }) => (res.body as { items: CategoryItem[] }).items;
const slugsOf = (res: { body: unknown }) => itemsOf(res).map((c) => c.slug);

describe('GET /api/service-categories: which categories customers see', () => {
  it('lists active categories that a city offers, without needing to sign in', async () => {
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/service-categories');

    expect(res.status).toBe(200);
    expect(slugsOf(res)).toEqual(['cleaning', 'electrical', 'plumbing']);
  });

  it('returns the fields the app needs, and nothing internal', async () => {
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/service-categories');

    const plumbing = itemsOf(res).find((c) => c.slug === 'plumbing');
    expect(plumbing).toEqual({
      id: catalogue.plumbing.id,
      slug: 'plumbing',
      name: 'Plumbing',
      description: 'Leaks, drains and taps.',
      pricingModel: 'quote',
    });
  });

  it('hides inactive categories', async () => {
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/service-categories');

    expect(slugsOf(res)).not.toContain('carpentry');
  });

  it('hides a category the moment it is deactivated, and shows it again when reactivated', async () => {
    const { app } = buildTestApp({ db });

    await setCategoryActive(db, catalogue.plumbing.id, false);
    expect(slugsOf(await request(app).get('/api/service-categories'))).not.toContain('plumbing');

    await setCategoryActive(db, catalogue.plumbing.id, true);
    expect(slugsOf(await request(app).get('/api/service-categories'))).toContain('plumbing');
  });

  it('hides a category that no city offers', async () => {
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/service-categories');

    expect(slugsOf(res)).not.toContain('painting');
  });

  it('hides a category whose only city switched it off, or whose city is inactive', async () => {
    const { app } = buildTestApp({ db });

    await db
      .update(cityCategories)
      .set({ isActive: false })
      .where(
        and(
          eq(cityCategories.cityId, catalogue.colombo.id),
          eq(cityCategories.serviceCategoryId, catalogue.cleaning.id),
        ),
      );
    expect(slugsOf(await request(app).get('/api/service-categories'))).toEqual([
      'electrical',
      'plumbing',
    ]);

    await setCityActive(db, catalogue.colombo.id, false);
    expect(slugsOf(await request(app).get('/api/service-categories'))).toEqual([]);
  });

  it('returns an empty list, not an error, when nothing is available', async () => {
    await resetDatabase(db);
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/service-categories');

    expect(res.status).toBe(200);
    expect(itemsOf(res)).toEqual([]);
  });

  it('is read-only: there is no way to create, change or delete categories', async () => {
    const { app } = buildTestApp({ db });

    for (const [method, path] of [
      ['post', '/api/service-categories'],
      ['put', '/api/service-categories/plumbing'],
      ['patch', '/api/service-categories/plumbing'],
      ['delete', '/api/service-categories/plumbing'],
    ] as const) {
      const res = await request(app)[method](path).send({ name: 'Hacked', isActive: true });
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    expect(slugsOf(await request(app).get('/api/service-categories'))).toContain('plumbing');
  });
});

describe('GET /api/service-categories: search and filters', () => {
  it('filters by pricing model', async () => {
    const { app } = buildTestApp({ db });

    expect(slugsOf(await request(app).get('/api/service-categories?pricingModel=hourly'))).toEqual([
      'cleaning',
    ]);
    expect(slugsOf(await request(app).get('/api/service-categories?pricingModel=quote'))).toEqual([
      'electrical',
      'plumbing',
    ]);
    expect(slugsOf(await request(app).get('/api/service-categories?pricingModel=fixed'))).toEqual(
      [],
    );
  });

  it('filters by city', async () => {
    const kandy = await addKandy(db, catalogue);
    expect(kandy.slug).toBe('kandy');
    const { app } = buildTestApp({ db });

    expect(slugsOf(await request(app).get('/api/service-categories?city=kandy'))).toEqual([
      'plumbing',
    ]);
    expect(slugsOf(await request(app).get('/api/service-categories?city=colombo'))).toEqual([
      'cleaning',
      'electrical',
      'plumbing',
    ]);
    expect(slugsOf(await request(app).get('/api/service-categories?city=galle'))).toEqual([]);
  });

  it('searches names, descriptions and slugs, case-insensitively', async () => {
    const { app } = buildTestApp({ db });
    const search = async (q: string) =>
      slugsOf(await request(app).get('/api/service-categories').query({ q }));

    expect(await search('plumb')).toEqual(['plumbing']);
    expect(await search('PLUMB')).toEqual(['plumbing']);
    expect(await search('wiring')).toEqual(['electrical']); // description
    expect(await search('by the hour')).toEqual(['cleaning']); // description
    expect(await search('lighting')).toEqual(['electrical']);
    expect(await search('nothing-like-this')).toEqual([]);
  });

  it('finds a category through its Sinhala or Tamil name whatever language the screen is in', async () => {
    const { app } = buildTestApp({ db });
    const search = async (q: string) =>
      slugsOf(await request(app).get('/api/service-categories').query({ q }));

    expect(await search('ජලනල')).toEqual(['plumbing']);
    expect(await search('குழாய்')).toEqual(['plumbing']);
    expect(await search('විදුලි')).toEqual(['electrical']);
  });

  it('never finds hidden categories, even by exact name', async () => {
    const { app } = buildTestApp({ db });

    expect(
      slugsOf(await request(app).get('/api/service-categories').query({ q: 'carpentry' })),
    ).toEqual([]);
    expect(
      slugsOf(await request(app).get('/api/service-categories').query({ q: 'painting' })),
    ).toEqual([]);
  });

  it('treats % and _ in the search text literally, not as wildcards', async () => {
    const { app } = buildTestApp({ db });

    for (const q of ['%', '_', 'p%g', 'pl_mbing', '\\']) {
      const res = await request(app).get('/api/service-categories').query({ q });
      expect(res.status, q).toBe(200);
      expect(itemsOf(res), q).toEqual([]);
    }
  });

  it('treats an empty or blank search as no search', async () => {
    const { app } = buildTestApp({ db });

    for (const q of ['', '   ']) {
      const res = await request(app).get('/api/service-categories').query({ q });
      expect(slugsOf(res), JSON.stringify(q)).toHaveLength(3);
    }
  });

  it('combines a search with a filter', async () => {
    const { app } = buildTestApp({ db });

    const res = await request(app)
      .get('/api/service-categories')
      .query({ q: 'e', pricingModel: 'hourly' });

    expect(slugsOf(res)).toEqual(['cleaning']);
  });

  it('is safe against SQL injection in the search text', async () => {
    const { app } = buildTestApp({ db });

    const res = await request(app)
      .get('/api/service-categories')
      .query({ q: "'; DROP TABLE service_categories; --" });

    expect(res.status).toBe(200);
    expect(itemsOf(res)).toEqual([]);
    expect(slugsOf(await request(app).get('/api/service-categories'))).toHaveLength(3);
  });

  it('rejects invalid query parameters with a 400', async () => {
    const { app } = buildTestApp({ db });

    for (const query of [
      { pricingModel: 'free' },
      { city: 'Not A Slug' },
      { city: 'x'.repeat(65) },
      { q: 'x'.repeat(101) },
      { lang: 'fr' },
    ]) {
      const res = await request(app).get('/api/service-categories').query(query);
      expect(res.status, JSON.stringify(query)).toBe(400);
      expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('localization of catalogue text', () => {
  const plumbingIn = async (headers: Record<string, string>, query = '') => {
    const { app } = buildTestApp({ db });
    const res = await request(app).get(`/api/service-categories${query}`).set(headers);
    return { res, plumbing: itemsOf(res).find((c) => c.slug === 'plumbing') };
  };

  it('defaults to English', async () => {
    const { res, plumbing } = await plumbingIn({});
    expect((res.body as { language: string }).language).toBe('en');
    expect(plumbing?.name).toBe('Plumbing');
  });

  it('answers in Sinhala and Tamil, including descriptions', async () => {
    const si = await plumbingIn({}, '?lang=si');
    expect(si.plumbing).toMatchObject({ name: 'ජලනල කටයුතු', description: 'කාන්දු සහ කාණු.' });
    expect((si.res.body as { language: string }).language).toBe('si');

    const ta = await plumbingIn({}, '?lang=ta');
    expect(ta.plumbing).toMatchObject({
      name: 'குழாய் வேலை',
      description: 'கசிவு மற்றும் அடைப்பு.',
    });
  });

  it('follows Accept-Language when no ?lang is given', async () => {
    expect((await plumbingIn({ 'Accept-Language': 'si' })).plumbing?.name).toBe('ජලනල කටයුතු');
    expect(
      (await plumbingIn({ 'Accept-Language': 'si-LK,si;q=0.9,en;q=0.8' })).plumbing?.name,
    ).toBe('ජලනල කටයුතු');
    expect((await plumbingIn({ 'Accept-Language': 'fr,ta;q=0.7,en;q=0.5' })).plumbing?.name).toBe(
      'குழாய் வேலை',
    );
  });

  it('lets an explicit ?lang override the header', async () => {
    const { plumbing } = await plumbingIn({ 'Accept-Language': 'si' }, '?lang=ta');
    expect(plumbing?.name).toBe('குழாய் வேலை');
  });

  it('falls back to English for languages it does not support', async () => {
    const { res, plumbing } = await plumbingIn({ 'Accept-Language': 'fr-FR,de;q=0.8' });
    expect(plumbing?.name).toBe('Plumbing');
    expect((res.body as { language: string }).language).toBe('en');
  });

  it('falls back to English per field when a translation is missing', async () => {
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/service-categories?lang=si');

    // Electrical has a Sinhala name but no Sinhala description: name is Sinhala, description English.
    expect(itemsOf(res).find((c) => c.slug === 'electrical')).toMatchObject({
      name: 'විදුලි කටයුතු',
      description: 'Wiring and lighting.',
    });
    // Cleaning has no translation at all: fully English, never blank.
    expect(itemsOf(res).find((c) => c.slug === 'cleaning')).toMatchObject({
      name: 'Cleaning',
      description: 'Home cleaning by the hour.',
    });
  });

  it('tells caches that the answer depends on the language', async () => {
    const { app } = buildTestApp({ db });
    const res = await request(app).get('/api/service-categories');
    expect(res.headers.vary?.toLowerCase()).toContain('accept-language');
  });
});

describe('GET /api/service-categories/:slug', () => {
  it('returns the details of an active, offered category', async () => {
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/service-categories/plumbing');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: catalogue.plumbing.id,
      slug: 'plumbing',
      name: 'Plumbing',
      description: 'Leaks, drains and taps.',
      pricingModel: 'quote',
      language: 'en',
      availableProviderCount: 0,
      cities: [
        {
          slug: 'colombo',
          name: 'Colombo',
          countryCode: 'LK',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      ],
    });
  });

  it('lists every active city that offers the category', async () => {
    await addKandy(db, catalogue);
    const { app } = buildTestApp({ db });

    const plumbing = await request(app).get('/api/service-categories/plumbing');
    const electrical = await request(app).get('/api/service-categories/electrical');

    expect((plumbing.body as { cities: { slug: string }[] }).cities.map((c) => c.slug)).toEqual([
      'colombo',
      'kandy',
    ]);
    expect((electrical.body as { cities: { slug: string }[] }).cities.map((c) => c.slug)).toEqual([
      'colombo',
    ]);
  });

  it('is localized', async () => {
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/service-categories/plumbing?lang=si');

    expect(res.body).toMatchObject({ language: 'si', name: 'ජලනල කටයුතු' });
  });

  it('answers 404 for an inactive category, exactly as for one that does not exist', async () => {
    const { app } = buildTestApp({ db });

    const inactive = await request(app).get('/api/service-categories/carpentry');
    const unknown = await request(app).get('/api/service-categories/no-such-thing');
    const unoffered = await request(app).get('/api/service-categories/painting');

    for (const res of [inactive, unknown, unoffered]) {
      expect(res.status).toBe(404);
      expect(errorOf(res)).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Service category not found.',
      });
    }
  });

  it('rejects a malformed slug with a 400', async () => {
    const { app } = buildTestApp({ db });

    for (const slug of ['Not_A_Slug', 'UPPER', 'a--b', '-x', 'x'.repeat(65)]) {
      const res = await request(app).get(`/api/service-categories/${slug}`);
      expect(res.status, slug).toBe(400);
    }
  });
});

describe('GET /api/cities', () => {
  it('lists active cities with their currency and time zone', async () => {
    await addKandy(db, catalogue);
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/cities');

    expect(res.status).toBe(200);
    expect((res.body as { items: { slug: string }[] }).items.map((c) => c.slug)).toEqual([
      'colombo',
      'kandy',
    ]);
    expect((res.body as { items: object[] }).items[0]).toEqual({
      slug: 'colombo',
      name: 'Colombo',
      countryCode: 'LK',
      timezone: 'Asia/Colombo',
      currency: 'LKR',
    });
  });

  it('omits inactive cities, and never exposes internal ids', async () => {
    await setCityActive(db, catalogue.colombo.id, false);
    const { app } = buildTestApp({ db });

    const res = await request(app).get('/api/cities');

    expect((res.body as { items: unknown[] }).items).toEqual([]);
  });
});

describe('public catalogue rate limit', () => {
  it('limits requests per IP with the standard 429 body', async () => {
    const { app } = buildTestApp({
      db,
      catalogueRateLimit: { windowMs: 60_000, limit: 3 },
    });

    for (let i = 0; i < 3; i += 1) {
      expect((await request(app).get('/api/service-categories')).status).toBe(200);
    }
    const limited = await request(app).get('/api/service-categories');

    expect(limited.status).toBe(429);
    expect(errorOf(limited).code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
});
