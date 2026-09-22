import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  cities,
  cityCategories,
  providerProfiles,
  serviceCategories,
  serviceCategoryTranslations,
} from '../../src/db/schema/index.js';
import { createTestDatabase, expectPgError, PgCode, resetDatabase } from '../helpers/database.js';
import {
  createCategory,
  createCity,
  createProvider,
  offerCategory,
  only,
  translateCategory,
} from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

describe('cities', () => {
  it('stores a city with a currency and time zone, active by default', async () => {
    const city = await createCity(db);

    expect(city).toMatchObject({
      slug: 'colombo',
      countryCode: 'LK',
      timezone: 'Asia/Colombo',
      currency: 'LKR',
      isActive: true,
    });
  });

  it('has a unique slug', async () => {
    await createCity(db);
    const error = await expectPgError(() => createCity(db));
    expect(error).toEqual({ code: PgCode.uniqueViolation, constraint: 'cities_slug_uidx' });
  });

  it.each([
    ['a malformed slug', { slug: 'Colombo City' }, 'cities_slug_format'],
    ['a lower-case country code', { countryCode: 'lk' }, 'cities_country_code_format'],
    ['a three-letter country code', { countryCode: 'LKA' }, 'cities_country_code_format'],
    ['a lower-case currency', { currency: 'lkr' }, 'cities_currency_format'],
    ['a two-letter currency', { currency: 'LK' }, 'cities_currency_format'],
    ['a blank name', { name: '  ' }, 'cities_name_not_blank'],
    ['a blank time zone', { timezone: '' }, 'cities_timezone_not_blank'],
  ])('rejects %s', async (_name, override, constraint) => {
    const error = await expectPgError(() => createCity(db, override));
    expect(error).toEqual({ code: PgCode.checkViolation, constraint });
  });

  it('maintains updated_at', async () => {
    const city = await createCity(db);
    await db.update(cities).set({ isActive: false }).where(eq(cities.id, city.id));
    const after = only(await db.select().from(cities));
    expect(after.updatedAt.getTime()).toBeGreaterThan(city.updatedAt.getTime());
  });

  it('has no spatial column yet (boundaries arrive with the work that needs them)', async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns where table_name = 'cities'`,
    );
    const columns = result.rows.map((r) => r.column_name);
    expect(columns).not.toContain('boundary');
    expect(columns).not.toContain('location');
  });
});

describe('city_categories', () => {
  it('offers a category in a city once', async () => {
    const city = await createCity(db);
    const category = await createCategory(db);
    const offering = await offerCategory(db, city, category);
    expect(offering.isActive).toBe(true);

    const error = await expectPgError(() => offerCategory(db, city, category));
    expect(error).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'city_categories_city_category_uidx',
    });
  });

  it('lets a category be offered in many cities and a city offer many categories', async () => {
    const colombo = await createCity(db);
    const kandy = await createCity(db, { slug: 'kandy', name: 'Kandy' });
    const plumbing = await createCategory(db);
    const cleaning = await createCategory(db, { slug: 'cleaning', name: 'Cleaning' });

    await offerCategory(db, colombo, plumbing);
    await offerCategory(db, kandy, plumbing);
    await offerCategory(db, colombo, cleaning);

    expect(await db.select().from(cityCategories)).toHaveLength(3);
  });

  it('cannot reference a missing city or category, nor be orphaned by deleting one', async () => {
    const city = await createCity(db);
    const category = await createCategory(db);
    await offerCategory(db, city, category);
    const missing = '00000000-0000-4000-8000-000000000000';

    const badCity = await expectPgError(() =>
      db.insert(cityCategories).values({ cityId: missing, serviceCategoryId: category.id }),
    );
    const deleteCity = await expectPgError(() => db.delete(cities).where(eq(cities.id, city.id)));
    const deleteCategory = await expectPgError(() =>
      db.delete(serviceCategories).where(eq(serviceCategories.id, category.id)),
    );

    expect(badCity.code).toBe(PgCode.foreignKeyViolation);
    expect(deleteCity.code).toBe(PgCode.foreignKeyViolation);
    expect(deleteCategory.code).toBe(PgCode.foreignKeyViolation);
  });
});

describe('service_category_translations', () => {
  it('stores one translation per category and language', async () => {
    const category = await createCategory(db);
    await translateCategory(db, category, 'si', 'ජලනල', 'විස්තරය');
    await translateCategory(db, category, 'ta', 'குழாய்');

    const error = await expectPgError(() => translateCategory(db, category, 'si', 'again'));
    expect(error).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'service_category_translations_category_language_uidx',
    });
  });

  it('accepts only the supported languages', async () => {
    const category = await createCategory(db);

    const error = await expectPgError(() =>
      db.execute(
        sql`insert into service_category_translations (service_category_id, language, name)
            values (${category.id}, 'fr', 'Plomberie')`,
      ),
    );
    expect(error.code).toBe(PgCode.invalidEnumValue);
  });

  it('rejects a blank name but allows no description', async () => {
    const category = await createCategory(db);

    const blank = await expectPgError(() => translateCategory(db, category, 'si', '   '));
    expect(blank.constraint).toBe('service_category_translations_name_not_blank');

    const row = await translateCategory(db, category, 'ta', 'குழாய்');
    expect(row.description).toBeNull();
  });

  it('cannot outlive its category', async () => {
    const category = await createCategory(db);
    await translateCategory(db, category, 'si', 'ජලනල');

    const error = await expectPgError(() =>
      db.delete(serviceCategories).where(eq(serviceCategories.id, category.id)),
    );
    expect(error.code).toBe(PgCode.foreignKeyViolation);
    expect(await db.select().from(serviceCategoryTranslations)).toHaveLength(1);
  });
});

describe('provider_profiles: provider information', () => {
  it('starts as a draft with no submission or review recorded', async () => {
    const { profile } = await createProvider(db);

    expect(profile).toMatchObject({
      verificationStatus: 'draft',
      submittedAt: null,
      reviewedAt: null,
      reviewNote: null,
      bio: null,
      yearsOfExperience: null,
      availability: 'offline',
    });
  });

  it.each([
    ['a blank bio', { bio: '   ' }, 'provider_profiles_bio_valid'],
    ['a bio over 1000 characters', { bio: 'x'.repeat(1001) }, 'provider_profiles_bio_valid'],
    ['negative experience', { yearsOfExperience: -1 }, 'provider_profiles_experience_range'],
    ['experience over 60', { yearsOfExperience: 61 }, 'provider_profiles_experience_range'],
  ])('rejects %s', async (_name, values, constraint) => {
    const { profile } = await createProvider(db);

    const error = await expectPgError(() =>
      db.update(providerProfiles).set(values).where(eq(providerProfiles.id, profile.id)),
    );

    expect(error).toEqual({ code: PgCode.checkViolation, constraint });
  });

  it('accepts the boundary values', async () => {
    const { profile } = await createProvider(db);

    await db
      .update(providerProfiles)
      .set({ bio: 'x'.repeat(1000), yearsOfExperience: 60 })
      .where(eq(providerProfiles.id, profile.id));
    await db
      .update(providerProfiles)
      .set({ yearsOfExperience: 0 })
      .where(eq(providerProfiles.id, profile.id));
  });

  it('requires a submission time for anything past draft', async () => {
    const { profile } = await createProvider(db);

    for (const status of ['submitted', 'verified', 'rejected'] as const) {
      const error = await expectPgError(() =>
        db
          .update(providerProfiles)
          .set({ verificationStatus: status, reviewedAt: new Date() })
          .where(eq(providerProfiles.id, profile.id)),
      );
      expect(error.constraint, status).toBe('provider_profiles_submitted_has_timestamp');
    }
  });

  it('requires a review time for a verified or rejected decision', async () => {
    const { profile } = await createProvider(db);

    for (const status of ['verified', 'rejected'] as const) {
      const error = await expectPgError(() =>
        db
          .update(providerProfiles)
          .set({ verificationStatus: status, submittedAt: new Date() })
          .where(eq(providerProfiles.id, profile.id)),
      );
      expect(error.constraint, status).toBe('provider_profiles_decision_has_timestamp');
    }

    // A submitted profile awaiting review needs no review time.
    await db
      .update(providerProfiles)
      .set({ verificationStatus: 'submitted', submittedAt: new Date() })
      .where(eq(providerProfiles.id, profile.id));
  });

  it('rejects an unknown verification status', async () => {
    const { profile } = await createProvider(db);

    const error = await expectPgError(() =>
      db.execute(
        sql`update provider_profiles set verification_status = 'approved' where id = ${profile.id}`,
      ),
    );
    expect(error.code).toBe(PgCode.invalidEnumValue);
  });
});
