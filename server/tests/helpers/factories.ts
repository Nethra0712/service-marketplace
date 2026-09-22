import type { Database } from '../../src/db/client.js';
import {
  cities,
  cityCategories,
  providerProfiles,
  providerServices,
  serviceCategories,
  serviceCategoryTranslations,
  users,
  type AppLanguage,
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
