import type { Database } from '../client.js';
import { serviceCategories, type NewServiceCategory } from '../schema/index.js';

/**
 * DEVELOPMENT EXAMPLE DATA ONLY.
 *
 * These are placeholders so local development has something to work with. The
 * real launch catalogue, and the pricing model chosen for each category, are
 * product decisions that have not been made yet. Production categories are
 * created through the admin tooling, never by this seed.
 */
export const devServiceCategories = [
  { slug: 'plumbing', name: 'Plumbing', pricingModel: 'quote' },
  { slug: 'electrical', name: 'Electrical', pricingModel: 'quote' },
  { slug: 'cleaning', name: 'Cleaning', pricingModel: 'hourly' },
  { slug: 'ac-repair', name: 'AC Repair', pricingModel: 'fixed' },
  { slug: 'carpentry', name: 'Carpentry', pricingModel: 'quote' },
] as const satisfies readonly NewServiceCategory[];

/**
 * Inserts the example categories. Idempotent: existing rows (matched by slug)
 * are left untouched, so re-running never overwrites later edits.
 *
 * @returns how many rows were newly inserted
 */
export async function seedServiceCategories(db: Database): Promise<number> {
  const inserted = await db
    .insert(serviceCategories)
    .values([...devServiceCategories])
    .onConflictDoNothing({ target: serviceCategories.slug })
    .returning({ id: serviceCategories.id });

  return inserted.length;
}
