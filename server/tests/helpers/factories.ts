import { eq } from 'drizzle-orm';

import type { Database } from '../../src/db/client.js';
import {
  bookingOffers,
  bookings,
  cities,
  cityCategories,
  providerProfiles,
  providerServices,
  serviceCategories,
  serviceCategoryTranslations,
  users,
  type AppLanguage,
  type NewBooking,
  type NewBookingOffer,
  type NewCity,
  type NewServiceCategory,
} from '../../src/db/schema/index.js';

/** Returns the single row an insert produced. */
export function only<T>(rows: T[]): T {
  const [row] = rows;
  if (!row) throw new Error('Expected exactly one row');
  return row;
}

let phoneCounter = 0;

/** Each call yields a distinct, valid E.164 number. */
export function nextPhone(): string {
  phoneCounter += 1;
  return `+9477${String(1_000_000 + phoneCounter)}`;
}

export async function createUser(db: Database, phoneE164: string = nextPhone()) {
  return only(await db.insert(users).values({ phoneE164 }).returning());
}

/** A user who is also a provider. */
export async function createProvider(db: Database) {
  const user = await createUser(db);
  const profile = only(await db.insert(providerProfiles).values({ userId: user.id }).returning());
  return { user, profile };
}

export async function createCategory(db: Database, overrides: Partial<NewServiceCategory> = {}) {
  return only(
    await db
      .insert(serviceCategories)
      .values({ slug: 'plumbing', name: 'Plumbing', pricingModel: 'quote', ...overrides })
      .returning(),
  );
}

export async function createCity(db: Database, overrides: Partial<NewCity> = {}) {
  return only(
    await db
      .insert(cities)
      .values({
        slug: 'colombo',
        name: 'Colombo',
        countryCode: 'LK',
        timezone: 'Asia/Colombo',
        currency: 'LKR',
        ...overrides,
      })
      .returning(),
  );
}

/** Offers `category` in `city`. */
export async function offerCategory(
  db: Database,
  city: { id: string },
  category: { id: string },
  isActive = true,
) {
  return only(
    await db
      .insert(cityCategories)
      .values({ cityId: city.id, serviceCategoryId: category.id, isActive })
      .returning(),
  );
}

export async function translateCategory(
  db: Database,
  category: { id: string },
  language: AppLanguage,
  name: string,
  description?: string,
) {
  return only(
    await db
      .insert(serviceCategoryTranslations)
      .values({ serviceCategoryId: category.id, language, name, description })
      .returning(),
  );
}

/** A category that is active and offered in `city`, i.e. customer-visible. */
export async function createOfferedCategory(
  db: Database,
  city: { id: string },
  overrides: Partial<NewServiceCategory> = {},
) {
  const category = await createCategory(db, overrides);
  await offerCategory(db, city, category);
  return category;
}

/**
 * A provider who can actually be booked AND dispatched to: verified profile,
 * approved application, active account, online availability. Used across the
 * booking tests wherever a scenario needs a provider who satisfies every
 * eligibility rule (including matching's dispatch-specific ones — see
 * `providers.repository.ts#listDispatchCandidates`).
 */
export async function createApprovedProvider(
  db: Database,
  category: { id: string },
  city: { id: string },
) {
  const { user, profile } = await createProvider(db);
  await db
    .update(providerProfiles)
    .set({
      verificationStatus: 'verified',
      submittedAt: new Date(),
      reviewedAt: new Date(),
      availability: 'online',
    })
    .where(eq(providerProfiles.id, profile.id));
  const application = await createApplication(db, profile.id, category, city, 'approved');
  return { user, profile, application };
}

/** Sets a provider's latest known location directly, for distance-ranking tests. */
export async function setProviderLocation(
  db: Database,
  profile: { id: string },
  latitude: number,
  longitude: number,
) {
  await db
    .update(providerProfiles)
    .set({
      lastLatitude: latitude.toFixed(6),
      lastLongitude: longitude.toFixed(6),
      lastLocationAt: new Date(),
    })
    .where(eq(providerProfiles.id, profile.id));
}

/**
 * A minimal, valid `searching` on-demand booking, inserted directly (not
 * through the service). Used by the schema tests and as a base state for
 * behaviour tests that need to reach into the row directly.
 */
export async function createBooking(
  db: Database,
  customer: { id: string },
  category: { id: string; pricingModel?: string },
  city: { id: string },
  overrides: Partial<NewBooking> = {},
) {
  return only(
    await db
      .insert(bookings)
      .values({
        customerId: customer.id,
        serviceCategoryId: category.id,
        cityId: city.id,
        bookingType: 'on_demand',
        pricingModel: (category.pricingModel ?? 'quote') as NewBooking['pricingModel'],
        serviceAddress: '12 Galle Road, Colombo 03',
        ...overrides,
      })
      .returning(),
  );
}

/** A dispatch offer, inserted directly. Used by repository-level guard tests. */
export async function createOffer(
  db: Database,
  booking: { id: string },
  provider: { id: string },
  overrides: Partial<NewBookingOffer> = {},
) {
  const offeredAt = overrides.offeredAt ?? new Date();
  return only(
    await db
      .insert(bookingOffers)
      .values({
        bookingId: booking.id,
        providerProfileId: provider.id,
        wave: 1,
        offeredAt,
        respondsBy: new Date(offeredAt.getTime() + 45_000),
        ...overrides,
      })
      .returning(),
  );
}

/** Puts a provider's application straight into `status`, as a reviewer would have. */
export async function createApplication(
  db: Database,
  providerProfileId: string,
  category: { id: string },
  city: { id: string },
  status: 'pending' | 'approved' | 'rejected' | 'suspended' = 'pending',
) {
  return only(
    await db
      .insert(providerServices)
      .values({
        providerProfileId,
        serviceCategoryId: category.id,
        cityId: city.id,
        status,
        reviewedAt: status === 'pending' ? null : new Date(),
      })
      .returning(),
  );
}
