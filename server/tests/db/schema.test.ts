import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { profiles, providerProfiles, serviceCategories, users } from '../../src/db/schema/index.js';
import { createTestDatabase, expectPgError, PgCode, resetDatabase } from '../helpers/database.js';
import { createCategory, createProvider, createUser, only } from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

describe('database setup', () => {
  it('has migrated the five foundation tables', async () => {
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public'
            and table_name in ('users', 'profiles', 'provider_profiles',
                               'service_categories', 'provider_services')`,
    );
    expect(result.rows.map((r) => r.table_name).sort()).toEqual([
      'profiles',
      'provider_profiles',
      'provider_services',
      'service_categories',
      'users',
    ]);
  });

  it('has PostGIS installed and working', async () => {
    const ext = await db.execute<{ extname: string }>(
      sql`select extname from pg_extension where extname = 'postgis'`,
    );
    expect(ext.rows).toHaveLength(1);

    const point = await db.execute<{ wkt: string }>(
      sql`select ST_AsText(ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326)) as wkt`,
    );
    expect(point.rows[0]?.wkt).toBe('POINT(79.8612 6.9271)');
  });
});

describe('users', () => {
  it('stores a valid E.164 phone number with sensible defaults', async () => {
    const user = await createUser(db, '+94771234567');

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.status).toBe('active');
    expect(user.deletedAt).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it.each(['0771234567', '94771234567', '+0771234567', '+94 77 123 4567', '+947712345678901234'])(
    'rejects malformed phone number %s',
    async (phone) => {
      const error = await expectPgError(() => createUser(db, phone));
      expect(error).toEqual({ code: PgCode.checkViolation, constraint: 'users_phone_e164_format' });
    },
  );

  it('does not allow two live accounts with the same phone number', async () => {
    await createUser(db, '+94771234567');

    const error = await expectPgError(() => createUser(db, '+94771234567'));
    expect(error).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'users_phone_e164_active_uidx',
    });
  });

  it('frees the phone number once the account is soft-deleted', async () => {
    const first = await createUser(db, '+94771234567');
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, first.id));

    const second = await createUser(db, '+94771234567');
    expect(second.id).not.toBe(first.id);
  });

  it('rejects an unknown status', async () => {
    const error = await expectPgError(() =>
      db.execute(sql`insert into users (phone_e164, status) values ('+94771234567', 'banned')`),
    );
    expect(error.code).toBe(PgCode.invalidEnumValue);
  });

  it('maintains updated_at, but only for real changes', async () => {
    const user = await createUser(db);

    await db.update(users).set({ status: 'active' }).where(eq(users.id, user.id));
    const afterNoOp = only(await db.select().from(users).where(eq(users.id, user.id)));
    expect(afterNoOp.updatedAt.getTime()).toBe(user.updatedAt.getTime());

    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, user.id));
    const afterChange = only(await db.select().from(users).where(eq(users.id, user.id)));
    expect(afterChange.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
  });
});

describe('profiles', () => {
  it('has at most one profile per user and defaults the language to English', async () => {
    const user = await createUser(db);
    const profile = only(
      await db.insert(profiles).values({ userId: user.id, fullName: 'Nimal Perera' }).returning(),
    );
    expect(profile.preferredLanguage).toBe('en');

    const error = await expectPgError(() => db.insert(profiles).values({ userId: user.id }));
    expect(error).toEqual({ code: PgCode.uniqueViolation, constraint: 'profiles_user_id_uidx' });
  });

  it('accepts the three supported languages and rejects others', async () => {
    for (const language of ['en', 'si', 'ta'] as const) {
      const user = await createUser(db);
      await db.insert(profiles).values({ userId: user.id, preferredLanguage: language });
    }

    const user = await createUser(db);
    const error = await expectPgError(() =>
      db.execute(sql`insert into profiles (user_id, preferred_language) values (${user.id}, 'fr')`),
    );
    expect(error.code).toBe(PgCode.invalidEnumValue);
  });

  it('rejects a blank name but allows no name yet', async () => {
    const user = await createUser(db);
    const error = await expectPgError(() =>
      db.insert(profiles).values({ userId: user.id, fullName: '   ' }),
    );
    expect(error.constraint).toBe('profiles_full_name_not_blank');

    await expect(db.insert(profiles).values({ userId: user.id })).resolves.toBeDefined();
  });

  it('cannot be orphaned: a user with a profile cannot be hard-deleted', async () => {
    const user = await createUser(db);
    await db.insert(profiles).values({ userId: user.id });

    const error = await expectPgError(() => db.delete(users).where(eq(users.id, user.id)));
    expect(error.code).toBe(PgCode.foreignKeyViolation);
  });
});

describe('provider profiles', () => {
  it('makes a user a provider, defaulting to offline, at most once', async () => {
    const { user, profile } = await createProvider(db);
    expect(profile.availability).toBe('offline');

    const error = await expectPgError(() =>
      db.insert(providerProfiles).values({ userId: user.id }),
    );
    expect(error).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'provider_profiles_user_id_uidx',
    });
  });

  it('lets one user be a customer and a provider without a second user record', async () => {
    const { user } = await createProvider(db);
    await db.insert(profiles).values({ userId: user.id, fullName: 'Kasun' });

    const { count } = only(await db.select({ count: sql<number>`count(*)::int` }).from(users));
    expect(count).toBe(1);
  });
});

describe('service categories', () => {
  it('stores a category, active by default, for each pricing model', async () => {
    for (const [slug, pricingModel, baseRate] of [
      ['plumbing', 'quote', undefined],
      ['cleaning', 'hourly', '1500.00'],
      ['ac-repair', 'fixed', '6000.00'],
    ] as const) {
      const category = await createCategory(db, { slug, name: slug, pricingModel, baseRate });
      expect(category.pricingModel).toBe(pricingModel);
      expect(category.baseRate).toBe(baseRate ?? null);
      expect(category.isActive).toBe(true);
    }
  });

  it('requires a base rate for fixed/hourly pricing, and forbids one for quote pricing', async () => {
    const missingRate = await expectPgError(() =>
      createCategory(db, { slug: 'no-rate', name: 'No rate', pricingModel: 'fixed' }),
    );
    expect(missingRate.constraint).toBe('service_categories_base_rate_matches_pricing_model');

    const unexpectedRate = await expectPgError(() =>
      createCategory(db, {
        slug: 'unexpected-rate',
        name: 'Unexpected rate',
        pricingModel: 'quote',
        baseRate: '100.00',
      }),
    );
    expect(unexpectedRate.constraint).toBe('service_categories_base_rate_matches_pricing_model');

    const nonPositiveRate = await expectPgError(() =>
      createCategory(db, {
        slug: 'zero-rate',
        name: 'Zero rate',
        pricingModel: 'fixed',
        baseRate: '0.00',
      }),
    );
    expect(nonPositiveRate.constraint).toBe('service_categories_base_rate_positive');
  });

  it('rejects an unknown pricing model', async () => {
    const error = await expectPgError(() =>
      db.execute(
        sql`insert into service_categories (slug, name, pricing_model) values ('x', 'X', 'barter')`,
      ),
    );
    expect(error.code).toBe(PgCode.invalidEnumValue);
  });

  it('requires unique, well-formed slugs', async () => {
    await createCategory(db, { slug: 'plumbing' });

    const duplicate = await expectPgError(() => createCategory(db, { slug: 'plumbing' }));
    expect(duplicate).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'service_categories_slug_uidx',
    });

    for (const slug of ['Plumbing', 'ac repair', '-plumbing', 'plumbing-', 'a--b', '']) {
      const error = await expectPgError(() => createCategory(db, { slug }));
      expect(error.constraint, `slug "${slug}"`).toBe('service_categories_slug_format');
    }
  });

  it('can be deactivated without being deleted', async () => {
    const category = await createCategory(db);
    await db
      .update(serviceCategories)
      .set({ isActive: false })
      .where(eq(serviceCategories.id, category.id));

    const [row] = await db.select().from(serviceCategories);
    expect(row?.isActive).toBe(false);
  });
});
