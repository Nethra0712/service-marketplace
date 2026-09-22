import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  cityCategories,
  providerProfiles,
  providerServices,
  users,
  type ProviderServiceStatus,
  type ProviderVerificationStatus,
} from '../../src/db/schema/index.js';
import { createProvidersService } from '../../src/modules/providers/providers.service.js';
import { FakeClock, buildTestApp } from '../helpers/app.js';
import {
  addKandy,
  createCatalogue,
  setCategoryActive,
  setCityActive,
  type Catalogue,
} from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApplication, createProvider } from '../helpers/factories.js';

/**
 * "Do not allow customers to book unapproved provider services."
 *
 * There is no booking yet, but there is already ONE place that decides who could
 * be booked: the providers service's bookable query. Booking and matching will
 * call it. These tests pin down every way a provider can fail to qualify.
 */
const handle = createTestDatabase();
const { db } = handle;

let catalogue: Catalogue;
beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
});
afterAll(() => handle.close());

const providers = () => createProvidersService({ db, clock: new FakeClock().now });

interface Options {
  applicationStatus?: ProviderServiceStatus;
  verification?: ProviderVerificationStatus;
}

/** A provider who satisfies EVERY condition, unless an option says otherwise. */
async function makeProvider({
  applicationStatus = 'approved',
  verification = 'verified',
}: Options = {}) {
  const { user, profile } = await createProvider(db);
  await db
    .update(providerProfiles)
    .set({
      verificationStatus: verification,
      submittedAt: verification === 'draft' ? null : new Date(),
      reviewedAt: verification === 'verified' || verification === 'rejected' ? new Date() : null,
    })
    .where(eq(providerProfiles.id, profile.id));
  const application = await createApplication(
    db,
    profile.id,
    catalogue.plumbing,
    catalogue.colombo,
    applicationStatus,
  );
  return { user, profile, application };
}

const plumbingInColombo = () => ({
  serviceCategoryId: catalogue.plumbing.id,
  cityId: catalogue.colombo.id,
});

describe('the bookable gate', () => {
  it('includes a provider who is approved, verified and active', async () => {
    const { profile, application } = await makeProvider();

    const list = await providers().listBookableProviderServices(plumbingInColombo());

    expect(list).toEqual([
      {
        providerServiceId: application.id,
        providerProfileId: profile.id,
        serviceCategoryId: catalogue.plumbing.id,
        cityId: catalogue.colombo.id,
      },
    ]);
    expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(true);
  });

  it.each(['pending', 'rejected', 'suspended'] as const)(
    'excludes a provider whose category application is %s',
    async (status) => {
      const { profile } = await makeProvider({ applicationStatus: status });

      expect(await providers().listBookableProviderServices(plumbingInColombo())).toEqual([]);
      expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(false);
      expect(await providers().countBookableProviders(plumbingInColombo())).toBe(0);
    },
  );

  it.each(['draft', 'submitted', 'rejected'] as const)(
    'excludes an approved category when the provider themself is %s, not verified',
    async (verification) => {
      const { profile } = await makeProvider({ verification });

      expect(await providers().listBookableProviderServices(plumbingInColombo())).toEqual([]);
      expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(false);
    },
  );

  it('excludes a suspended account and a deleted account', async () => {
    const suspended = await makeProvider();
    const deleted = await makeProvider();
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, suspended.user.id));
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.user.id));

    expect(await providers().listBookableProviderServices(plumbingInColombo())).toEqual([]);
    expect(await providers().isBookable(suspended.profile.id, plumbingInColombo())).toBe(false);
    expect(await providers().isBookable(deleted.profile.id, plumbingInColombo())).toBe(false);
  });

  it('excludes everyone when the category is deactivated, and again includes them when reactivated', async () => {
    const { profile } = await makeProvider();

    await setCategoryActive(db, catalogue.plumbing.id, false);
    expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(false);

    await setCategoryActive(db, catalogue.plumbing.id, true);
    expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(true);
  });

  it('excludes everyone when the city is deactivated, or stops offering the category', async () => {
    const { profile } = await makeProvider();

    await setCityActive(db, catalogue.colombo.id, false);
    expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(false);
    await setCityActive(db, catalogue.colombo.id, true);

    await db
      .update(cityCategories)
      .set({ isActive: false })
      .where(eq(cityCategories.serviceCategoryId, catalogue.plumbing.id));
    expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(false);
  });

  it('is specific to the category: approval for plumbing says nothing about electrical', async () => {
    const { profile } = await makeProvider();
    await createApplication(db, profile.id, catalogue.electrical, catalogue.colombo, 'pending');

    expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(true);
    expect(
      await providers().isBookable(profile.id, {
        serviceCategoryId: catalogue.electrical.id,
        cityId: catalogue.colombo.id,
      }),
    ).toBe(false);
    // A category the provider never applied for at all.
    expect(
      await providers().isBookable(profile.id, {
        serviceCategoryId: catalogue.cleaning.id,
        cityId: catalogue.colombo.id,
      }),
    ).toBe(false);
  });

  it('is specific to the city: approval in Colombo says nothing about Kandy', async () => {
    const kandy = await addKandy(db, catalogue);
    const { profile } = await makeProvider();

    expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(true);
    expect(
      await providers().isBookable(profile.id, {
        serviceCategoryId: catalogue.plumbing.id,
        cityId: kandy.id,
      }),
    ).toBe(false);
  });

  it('filters by category and city', async () => {
    const kandy = await addKandy(db, catalogue);
    const { profile } = await makeProvider();
    await createApplication(db, profile.id, catalogue.plumbing, kandy, 'approved');

    const inColombo = await providers().listBookableProviderServices({
      cityId: catalogue.colombo.id,
    });
    const inKandy = await providers().listBookableProviderServices({ cityId: kandy.id });
    const byCategory = await providers().listBookableProviderServices({
      serviceCategoryId: catalogue.electrical.id,
    });

    expect(inColombo).toHaveLength(1);
    expect(inKandy).toHaveLength(1);
    expect(byCategory).toEqual([]);
  });

  it('lists only the qualifying providers when several apply', async () => {
    const good = await makeProvider();
    await makeProvider({ applicationStatus: 'pending' });
    await makeProvider({ applicationStatus: 'suspended' });
    await makeProvider({ verification: 'submitted' });
    const good2 = await makeProvider();

    const list = await providers().listBookableProviderServices(plumbingInColombo());

    expect(list.map((r) => r.providerProfileId).sort()).toEqual(
      [good.profile.id, good2.profile.id].sort(),
    );
  });

  it('counts providers, not rows: one provider in two cities counts once', async () => {
    const kandy = await addKandy(db, catalogue);
    const { profile } = await makeProvider();
    await createApplication(db, profile.id, catalogue.plumbing, kandy, 'approved');
    await makeProvider();

    expect(
      await providers().countBookableProviders({ serviceCategoryId: catalogue.plumbing.id }),
    ).toBe(2);
    expect(
      await providers().listBookableProviderServices({ serviceCategoryId: catalogue.plumbing.id }),
    ).toHaveLength(3);
  });

  it('always agrees between the list and the count', async () => {
    await makeProvider();
    await makeProvider({ applicationStatus: 'rejected' });
    await makeProvider({ verification: 'draft' });
    await makeProvider();

    const filter = plumbingInColombo();
    const list = await providers().listBookableProviderServices(filter);
    const count = await providers().countBookableProviders(filter);

    expect(count).toBe(new Set(list.map((r) => r.providerProfileId)).size);
  });

  it('reacts immediately to a status change', async () => {
    const { profile, application } = await makeProvider();
    expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(true);

    await db
      .update(providerServices)
      .set({ status: 'suspended', reviewedAt: new Date() })
      .where(eq(providerServices.id, application.id));

    expect(await providers().isBookable(profile.id, plumbingInColombo())).toBe(false);
  });
});

describe('what customers see of it: availableProviderCount', () => {
  it('counts only providers who could actually be booked', async () => {
    const { app } = buildTestApp({ db });
    await makeProvider();
    await makeProvider();
    await makeProvider({ applicationStatus: 'pending' });
    await makeProvider({ applicationStatus: 'rejected' });
    await makeProvider({ applicationStatus: 'suspended' });
    await makeProvider({ verification: 'submitted' });

    const res = await request(app).get('/api/service-categories/plumbing');

    expect((res.body as { availableProviderCount: number }).availableProviderCount).toBe(2);
  });

  it('is zero when nobody is approved, and does not count other categories or cities', async () => {
    const { app } = buildTestApp({ db });
    const { profile } = await makeProvider();
    await createApplication(db, profile.id, catalogue.electrical, catalogue.colombo, 'pending');

    const plumbing = await request(app).get('/api/service-categories/plumbing');
    const electrical = await request(app).get('/api/service-categories/electrical');
    const cleaning = await request(app).get('/api/service-categories/cleaning');

    expect((plumbing.body as { availableProviderCount: number }).availableProviderCount).toBe(1);
    expect((electrical.body as { availableProviderCount: number }).availableProviderCount).toBe(0);
    expect((cleaning.body as { availableProviderCount: number }).availableProviderCount).toBe(0);
  });

  it('can be scoped to one city', async () => {
    const kandy = await addKandy(db, catalogue);
    const { app } = buildTestApp({ db });
    await makeProvider();
    const other = await makeProvider({ applicationStatus: 'pending' });
    await createApplication(db, other.profile.id, catalogue.plumbing, kandy, 'approved');
    await db
      .update(providerProfiles)
      .set({ verificationStatus: 'verified', submittedAt: new Date(), reviewedAt: new Date() })
      .where(eq(providerProfiles.id, other.profile.id));

    const colombo = await request(app).get('/api/service-categories/plumbing?city=colombo');
    const kandyRes = await request(app).get('/api/service-categories/plumbing?city=kandy');

    expect((colombo.body as { availableProviderCount: number }).availableProviderCount).toBe(1);
    expect((kandyRes.body as { availableProviderCount: number }).availableProviderCount).toBe(1);
  });

  it('never reveals who the providers are', async () => {
    const { app } = buildTestApp({ db });
    await makeProvider();

    const res = await request(app).get('/api/service-categories/plumbing');

    expect(Object.keys(res.body as object).sort()).toEqual([
      'availableProviderCount',
      'cities',
      'description',
      'id',
      'language',
      'name',
      'pricingModel',
      'slug',
    ]);
  });
});
