import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { pricingModel, serviceCategories, users } from '../../src/db/schema/index.js';
import { assertSeedAllowed } from '../../src/db/seed/guard.js';
import {
  devServiceCategories,
  seedServiceCategories,
} from '../../src/db/seed/service-categories.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

describe('seedServiceCategories', () => {
  it('inserts the example categories, all active and validly priced', async () => {
    const inserted = await seedServiceCategories(db);

    const rows = await db.select().from(serviceCategories).orderBy(asc(serviceCategories.slug));
    expect(inserted).toBe(devServiceCategories.length);
    expect(rows.map((r) => r.slug)).toEqual([
      'ac-repair',
      'carpentry',
      'cleaning',
      'electrical',
      'plumbing',
    ]);
    expect(rows.every((r) => r.isActive)).toBe(true);
    expect(rows.every((r) => pricingModel.enumValues.includes(r.pricingModel))).toBe(true);
  });

  it('is idempotent: running it again adds nothing', async () => {
    await seedServiceCategories(db);
    const secondRun = await seedServiceCategories(db);

    expect(secondRun).toBe(0);
    expect(await db.select().from(serviceCategories)).toHaveLength(devServiceCategories.length);
  });

  it('never overwrites categories that were edited after seeding', async () => {
    await seedServiceCategories(db);
    await db
      .update(serviceCategories)
      .set({ name: 'Plumbing & Pipes', isActive: false })
      .where(eq(serviceCategories.slug, 'plumbing'));

    await seedServiceCategories(db);

    const [plumbing] = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.slug, 'plumbing'));
    expect(plumbing).toMatchObject({ name: 'Plumbing & Pipes', isActive: false });
  });

  it('creates no user or provider accounts', async () => {
    await seedServiceCategories(db);
    expect(await db.select().from(users)).toHaveLength(0);
  });
});

describe('assertSeedAllowed', () => {
  it('refuses to run in production', () => {
    expect(() => {
      assertSeedAllowed('production');
    }).toThrow(/production/);
  });

  it.each(['development', 'test'] as const)('allows %s', (env) => {
    expect(() => {
      assertSeedAllowed(env);
    }).not.toThrow();
  });
});
