import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  profiles,
  providerProfiles,
  providerServices,
  serviceCategories,
  users,
} from '../../src/db/schema/index.js';
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
    for (const [slug, pricingModel] of [
      ['plumbing', 'quote'],
      ['cleaning', 'hourly'],
      ['ac-repair', 'fixed'],
    ] as const) {
      const category = await createCategory(db, { slug, name: slug, pricingModel });
      expect(category.pricingModel).toBe(pricingModel);
      expect(category.isActive).toBe(true);
    }
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

describe('provider services (category-specific approval)', () => {
  it('approves a provider for one category independently of another', async () => {
    const { profile } = await createProvider(db);
    const plumbing = await createCategory(db, { slug: 'plumbing' });
    const electrical = await createCategory(db, { slug: 'electrical', name: 'Electrical' });

    await db.insert(providerServices).values([
      {
        providerProfileId: profile.id,
        serviceCategoryId: plumbing.id,
        status: 'approved',
        reviewedAt: new Date(),
      },
      { providerProfileId: profile.id, serviceCategoryId: electrical.id },
    ]);

    const approvedFor = (categoryId: string) =>
      db
        .select({ providerProfileId: providerServices.providerProfileId })
        .from(providerServices)
        .where(
          and(
            eq(providerServices.serviceCategoryId, categoryId),
            eq(providerServices.status, 'approved'),
          ),
        );

    expect(await approvedFor(plumbing.id)).toHaveLength(1);
    expect(await approvedFor(electrical.id)).toHaveLength(0);

    // Suspending plumbing leaves electrical's own state untouched.
    await db
      .update(providerServices)
      .set({ status: 'suspended', reviewNote: 'Complaint under review' })
      .where(eq(providerServices.serviceCategoryId, plumbing.id));
    const electricalRow = only(
      await db
        .select()
        .from(providerServices)
        .where(eq(providerServices.serviceCategoryId, electrical.id)),
    );
    expect(electricalRow.status).toBe('pending');
  });

  it('lets one provider offer many categories and one category have many providers', async () => {
    const a = await createProvider(db);
    const b = await createProvider(db);
    const plumbing = await createCategory(db, { slug: 'plumbing' });
    const cleaning = await createCategory(db, { slug: 'cleaning', pricingModel: 'hourly' });

    await db.insert(providerServices).values([
      { providerProfileId: a.profile.id, serviceCategoryId: plumbing.id },
      { providerProfileId: a.profile.id, serviceCategoryId: cleaning.id },
      { providerProfileId: b.profile.id, serviceCategoryId: plumbing.id },
    ]);

    const forPlumbing = await db
      .select()
      .from(providerServices)
      .where(eq(providerServices.serviceCategoryId, plumbing.id));
    const forProviderA = await db
      .select()
      .from(providerServices)
      .where(eq(providerServices.providerProfileId, a.profile.id));
    expect(forPlumbing).toHaveLength(2);
    expect(forProviderA).toHaveLength(2);
  });

  it('starts pending and rejects a duplicate application for the same category', async () => {
    const { profile } = await createProvider(db);
    const category = await createCategory(db);
    const row = only(
      await db
        .insert(providerServices)
        .values({ providerProfileId: profile.id, serviceCategoryId: category.id })
        .returning(),
    );
    expect(row.status).toBe('pending');
    expect(row.reviewedAt).toBeNull();

    const error = await expectPgError(() =>
      db
        .insert(providerServices)
        .values({ providerProfileId: profile.id, serviceCategoryId: category.id }),
    );
    expect(error).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'provider_services_provider_category_uidx',
    });
  });

  it('requires a review timestamp for any decision', async () => {
    const { profile } = await createProvider(db);
    const category = await createCategory(db);

    for (const status of ['approved', 'rejected', 'suspended'] as const) {
      const error = await expectPgError(() =>
        db
          .insert(providerServices)
          .values({ providerProfileId: profile.id, serviceCategoryId: category.id, status }),
      );
      expect(error.constraint, status).toBe('provider_services_decision_has_timestamp');
    }
  });

  it('rejects an unknown approval status', async () => {
    const { profile } = await createProvider(db);
    const category = await createCategory(db);

    const error = await expectPgError(() =>
      db.execute(
        sql`insert into provider_services (provider_profile_id, service_category_id, status)
            values (${profile.id}, ${category.id}, 'maybe')`,
      ),
    );
    expect(error.code).toBe(PgCode.invalidEnumValue);
  });

  it('refuses to delete a provider or category that still has service records', async () => {
    const { profile } = await createProvider(db);
    const category = await createCategory(db);
    await db
      .insert(providerServices)
      .values({ providerProfileId: profile.id, serviceCategoryId: category.id });

    const deleteCategory = await expectPgError(() =>
      db.delete(serviceCategories).where(eq(serviceCategories.id, category.id)),
    );
    const deleteProvider = await expectPgError(() =>
      db.delete(providerProfiles).where(eq(providerProfiles.id, profile.id)),
    );
    expect(deleteCategory.code).toBe(PgCode.foreignKeyViolation);
    expect(deleteProvider.code).toBe(PgCode.foreignKeyViolation);
  });

  it('rejects links to providers or categories that do not exist', async () => {
    const { profile } = await createProvider(db);
    const missing = '00000000-0000-4000-8000-000000000000';

    const error = await expectPgError(() =>
      db
        .insert(providerServices)
        .values({ providerProfileId: profile.id, serviceCategoryId: missing }),
    );
    expect(error.code).toBe(PgCode.foreignKeyViolation);
  });
});
