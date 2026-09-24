import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  cities,
  providerProfiles,
  providerServices,
  serviceCategories,
} from '../../src/db/schema/index.js';
import { createTestDatabase, expectPgError, PgCode, resetDatabase } from '../helpers/database.js';
import { createCategory, createCity, createProvider, only } from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;

beforeEach(() => resetDatabase(db));
afterAll(() => handle.close());

describe('provider services (category- and city-specific approval)', () => {
  it('approves a provider for one category independently of another', async () => {
    const { profile } = await createProvider(db);
    const city = await createCity(db);
    const plumbing = await createCategory(db, { slug: 'plumbing' });
    const electrical = await createCategory(db, { slug: 'electrical', name: 'Electrical' });

    await db.insert(providerServices).values([
      {
        providerProfileId: profile.id,
        serviceCategoryId: plumbing.id,
        cityId: city.id,
        status: 'approved',
        reviewedAt: new Date(),
      },
      { providerProfileId: profile.id, serviceCategoryId: electrical.id, cityId: city.id },
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

  it('approves a provider in one city independently of another city', async () => {
    const { profile } = await createProvider(db);
    const colombo = await createCity(db, { slug: 'colombo' });
    const kandy = await createCity(db, { slug: 'kandy', name: 'Kandy' });
    const plumbing = await createCategory(db);

    await db.insert(providerServices).values([
      {
        providerProfileId: profile.id,
        serviceCategoryId: plumbing.id,
        cityId: colombo.id,
        status: 'approved',
        reviewedAt: new Date(),
      },
      { providerProfileId: profile.id, serviceCategoryId: plumbing.id, cityId: kandy.id },
    ]);

    const rows = await db.select().from(providerServices);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.cityId === colombo.id)?.status).toBe('approved');
    expect(rows.find((r) => r.cityId === kandy.id)?.status).toBe('pending');
  });

  it('lets one provider offer many categories and one category have many providers', async () => {
    const a = await createProvider(db);
    const b = await createProvider(db);
    const city = await createCity(db);
    const plumbing = await createCategory(db, { slug: 'plumbing' });
    const cleaning = await createCategory(db, {
      slug: 'cleaning',
      pricingModel: 'hourly',
      baseRate: '1500.00',
    });

    await db.insert(providerServices).values([
      { providerProfileId: a.profile.id, serviceCategoryId: plumbing.id, cityId: city.id },
      { providerProfileId: a.profile.id, serviceCategoryId: cleaning.id, cityId: city.id },
      { providerProfileId: b.profile.id, serviceCategoryId: plumbing.id, cityId: city.id },
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

  it('starts pending and rejects a duplicate application for the same category and city', async () => {
    const { profile } = await createProvider(db);
    const city = await createCity(db);
    const category = await createCategory(db);
    const values = {
      providerProfileId: profile.id,
      serviceCategoryId: category.id,
      cityId: city.id,
    };
    const row = only(await db.insert(providerServices).values(values).returning());
    expect(row.status).toBe('pending');
    expect(row.reviewedAt).toBeNull();

    const error = await expectPgError(() => db.insert(providerServices).values(values));
    expect(error).toEqual({
      code: PgCode.uniqueViolation,
      constraint: 'provider_services_provider_category_city_uidx',
    });
  });

  it('requires a review timestamp for any decision', async () => {
    const { profile } = await createProvider(db);
    const city = await createCity(db);
    const category = await createCategory(db);

    for (const status of ['approved', 'rejected', 'suspended'] as const) {
      const error = await expectPgError(() =>
        db.insert(providerServices).values({
          providerProfileId: profile.id,
          serviceCategoryId: category.id,
          cityId: city.id,
          status,
        }),
      );
      expect(error.constraint, status).toBe('provider_services_decision_has_timestamp');
    }
  });

  it('rejects an unknown approval status', async () => {
    const { profile } = await createProvider(db);
    const city = await createCity(db);
    const category = await createCategory(db);

    const error = await expectPgError(() =>
      db.execute(
        sql`insert into provider_services (provider_profile_id, service_category_id, city_id, status)
            values (${profile.id}, ${category.id}, ${city.id}, 'maybe')`,
      ),
    );
    expect(error.code).toBe(PgCode.invalidEnumValue);
  });

  it('refuses to delete a provider, category or city that still has service records', async () => {
    const { profile } = await createProvider(db);
    const city = await createCity(db);
    const category = await createCategory(db);
    await db.insert(providerServices).values({
      providerProfileId: profile.id,
      serviceCategoryId: category.id,
      cityId: city.id,
    });

    const deleteCategory = await expectPgError(() =>
      db.delete(serviceCategories).where(eq(serviceCategories.id, category.id)),
    );
    const deleteProvider = await expectPgError(() =>
      db.delete(providerProfiles).where(eq(providerProfiles.id, profile.id)),
    );
    const deleteCity = await expectPgError(() => db.delete(cities).where(eq(cities.id, city.id)));
    expect(deleteCategory.code).toBe(PgCode.foreignKeyViolation);
    expect(deleteProvider.code).toBe(PgCode.foreignKeyViolation);
    expect(deleteCity.code).toBe(PgCode.foreignKeyViolation);
  });

  it('rejects links to categories or cities that do not exist', async () => {
    const { profile } = await createProvider(db);
    const city = await createCity(db);
    const category = await createCategory(db);
    const missing = '00000000-0000-4000-8000-000000000000';

    for (const bad of [
      { serviceCategoryId: missing, cityId: city.id },
      { serviceCategoryId: category.id, cityId: missing },
    ]) {
      const error = await expectPgError(() =>
        db.insert(providerServices).values({ providerProfileId: profile.id, ...bad }),
      );
      expect(error.code).toBe(PgCode.foreignKeyViolation);
    }
  });

  it('requires every application to name a city', async () => {
    const { profile } = await createProvider(db);
    const category = await createCategory(db);

    const error = await expectPgError(() =>
      db.execute(
        sql`insert into provider_services (provider_profile_id, service_category_id)
            values (${profile.id}, ${category.id})`,
      ),
    );
    expect(error.code).toBe('23502'); // not_null_violation
  });
});
