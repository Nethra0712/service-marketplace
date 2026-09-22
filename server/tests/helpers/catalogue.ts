import { eq } from 'drizzle-orm';

import type { Database } from '../../src/db/client.js';
import { cities, serviceCategories } from '../../src/db/schema/index.js';
import {
  createCategory,
  createCity,
  createOfferedCategory,
  offerCategory,
  translateCategory,
} from './factories.js';

/**
 * A small, realistic catalogue used across the catalogue and provider tests.
 *
 *   visible:  plumbing (quote), electrical (quote), cleaning (hourly)
 *   hidden:   carpentry (inactive category), painting (not offered in any city)
 */
export async function createCatalogue(db: Database) {
  const colombo = await createCity(db, { slug: 'colombo', name: 'Colombo' });

  const plumbing = await createOfferedCategory(db, colombo, {
    slug: 'plumbing',
    name: 'Plumbing',
    description: 'Leaks, drains and taps.',
    pricingModel: 'quote',
  });
  const electrical = await createOfferedCategory(db, colombo, {
    slug: 'electrical',
    name: 'Electrical',
    description: 'Wiring and lighting.',
    pricingModel: 'quote',
  });
  const cleaning = await createOfferedCategory(db, colombo, {
    slug: 'cleaning',
    name: 'Cleaning',
    description: 'Home cleaning by the hour.',
    pricingModel: 'hourly',
  });
  const carpentry = await createOfferedCategory(db, colombo, {
    slug: 'carpentry',
    name: 'Carpentry',
    pricingModel: 'quote',
    isActive: false,
  });
  const painting = await createCategory(db, {
    slug: 'painting',
    name: 'Painting',
    pricingModel: 'fixed',
  });

  await translateCategory(db, plumbing, 'si', 'ජලනල කටයුතු', 'කාන්දු සහ කාණු.');
  await translateCategory(db, plumbing, 'ta', 'குழாய் வேலை', 'கசிவு மற்றும் அடைப்பு.');
  // Electrical has a Sinhala name but no description translation.
  await translateCategory(db, electrical, 'si', 'විදුලි කටයුතු');

  return { colombo, plumbing, electrical, cleaning, carpentry, painting };
}

export type Catalogue = Awaited<ReturnType<typeof createCatalogue>>;

/** A second active city that offers only plumbing. */
export async function addKandy(db: Database, catalogue: Catalogue) {
  const kandy = await createCity(db, { slug: 'kandy', name: 'Kandy' });
  await offerCategory(db, kandy, catalogue.plumbing);
  return kandy;
}

export async function setCategoryActive(db: Database, id: string, isActive: boolean) {
  await db.update(serviceCategories).set({ isActive }).where(eq(serviceCategories.id, id));
}

export async function setCityActive(db: Database, id: string, isActive: boolean) {
  await db.update(cities).set({ isActive }).where(eq(cities.id, id));
}
