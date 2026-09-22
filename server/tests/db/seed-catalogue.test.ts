import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  cityCategories,
  providerProfiles,
  serviceCategories,
  serviceCategoryTranslations,
  users,
} from '../../src/db/schema/index.js';
import {
  devCategoryTranslations,
  devServiceCategories,
  seedCatalogue,
} from '../../src/db/seed/service-categories.js';
import { buildTestApp } from '../helpers/app.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createCity } from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(async () => {
  await resetDatabase(db);
  // Colombo is created by a migration in real databases; the tests truncate it.
  await createCity(db, { slug: 'colombo', name: 'Colombo' });
});
afterAll(() => handle.close());

describe('seedCatalogue', () => {
  it('seeds the categories, their Sinhala and Tamil wording, and their availability in Colombo', async () => {
    const result = await seedCatalogue(db);

    expect(result).toEqual({
      categories: devServiceCategories.length,
      translations: devServiceCategories.length * 2,
      cityLinks: devServiceCategories.length,
    });
    expect(await db.select().from(serviceCategoryTranslations)).toHaveLength(10);
    expect(await db.select().from(cityCategories)).toHaveLength(5);
  });

  it('is idempotent: a second run adds nothing', async () => {
    await seedCatalogue(db);

    expect(await seedCatalogue(db)).toEqual({ categories: 0, translations: 0, cityLinks: 0 });
    expect(await db.select().from(serviceCategories)).toHaveLength(5);
  });

  it('gives every seeded category a description and translations in both languages', async () => {
    await seedCatalogue(db);

    for (const category of devServiceCategories) {
      const [row] = await db
        .select()
        .from(serviceCategories)
        .where(eq(serviceCategories.slug, category.slug));
      expect(row?.description, category.slug).toBeTruthy();
      expect(
        Object.keys(devCategoryTranslations[category.slug] ?? {}).sort(),
        category.slug,
      ).toEqual(['si', 'ta']);
    }
  });

  it('never overwrites what was edited after seeding', async () => {
    await seedCatalogue(db);
    await db
      .update(serviceCategories)
      .set({ name: 'Plumbing & Pipes', description: 'Custom text.', isActive: false })
      .where(eq(serviceCategories.slug, 'plumbing'));
    await db
      .update(serviceCategoryTranslations)
      .set({ name: 'Edited Sinhala name' })
      .where(eq(serviceCategoryTranslations.language, 'si'));

    await seedCatalogue(db);

    const [plumbing] = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.slug, 'plumbing'));
    expect(plumbing).toMatchObject({
      name: 'Plumbing & Pipes',
      description: 'Custom text.',
      isActive: false,
    });
    const si = await db
      .select()
      .from(serviceCategoryTranslations)
      .where(eq(serviceCategoryTranslations.language, 'si'));
    expect(si.every((t) => t.name === 'Edited Sinhala name')).toBe(true);
  });

  it('fills in a missing description on an existing category, but only when it is missing', async () => {
    await db.insert(serviceCategories).values([
      { slug: 'plumbing', name: 'Plumbing', pricingModel: 'quote' },
      { slug: 'electrical', name: 'Electrical', pricingModel: 'quote', description: 'Mine.' },
    ]);

    await seedCatalogue(db);

    const rows = await db.select().from(serviceCategories);
    expect(rows.find((r) => r.slug === 'plumbing')?.description).toBe(
      'Leaks, blocked drains, taps, pipes and bathroom fittings.',
    );
    expect(rows.find((r) => r.slug === 'electrical')?.description).toBe('Mine.');
  });

  it('makes the seeded categories visible through the public API, in every language', async () => {
    await seedCatalogue(db);
    const { app } = buildTestApp({ db });

    const en = await request(app).get('/api/service-categories');
    const si = await request(app).get('/api/service-categories?lang=si');
    const ta = await request(app).get('/api/service-categories?lang=ta');

    const names = (res: { body: unknown }) =>
      (res.body as { items: { name: string }[] }).items.map((c) => c.name);
    expect(names(en)).toHaveLength(5);
    expect(names(si)).toContain('ජලනල කටයුතු');
    expect(names(ta)).toContain('குழாய் வேலை');
    // No English fallback leaked into a fully translated language.
    expect(names(si)).not.toContain('Plumbing');
  });

  it('creates no accounts, providers or applications', async () => {
    await seedCatalogue(db);

    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(providerProfiles)).toHaveLength(0);
  });

  it('explains what to do when the city has not been created', async () => {
    await resetDatabase(db);

    await expect(seedCatalogue(db)).rejects.toThrow(/db:migrate/);
  });
});
