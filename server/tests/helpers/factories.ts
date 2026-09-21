import type { Database } from '../../src/db/client.js';
import {
  providerProfiles,
  serviceCategories,
  users,
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
