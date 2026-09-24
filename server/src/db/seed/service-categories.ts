import { and, eq, isNull, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import {
  cities,
  cityCategories,
  serviceCategories,
  serviceCategoryTranslations,
  type AppLanguage,
  type NewServiceCategory,
} from '../schema/index.js';

/**
 * DEVELOPMENT EXAMPLE DATA ONLY.
 *
 * These are placeholders so local development has something to work with. The
 * real launch catalogue, its wording, and the pricing model chosen for each
 * category are product decisions that have not been made yet. Production
 * categories are created through the admin tooling, never by this seed.
 */
export const devServiceCategories = [
  {
    slug: 'plumbing',
    name: 'Plumbing',
    description: 'Leaks, blocked drains, taps, pipes and bathroom fittings.',
    pricingModel: 'quote',
  },
  {
    slug: 'electrical',
    name: 'Electrical',
    description: 'Wiring, sockets, switches, lighting and electrical faults.',
    pricingModel: 'quote',
  },
  {
    slug: 'cleaning',
    name: 'Cleaning',
    description: 'Home and office cleaning, charged by the hour.',
    pricingModel: 'hourly',
    baseRate: '1500.00', // LKR per hour.
  },
  {
    slug: 'ac-repair',
    name: 'AC Repair',
    description: 'Air-conditioner servicing, gas top-up and repairs.',
    pricingModel: 'fixed',
    baseRate: '6000.00', // LKR per job.
  },
  {
    slug: 'carpentry',
    name: 'Carpentry',
    description: 'Furniture repair, fittings and custom woodwork.',
    pricingModel: 'quote',
  },
] as const satisfies readonly NewServiceCategory[];

/**
 * Example Sinhala and Tamil wording for the example categories. These need
 * review by native speakers before any real use.
 */
export const devCategoryTranslations: Record<
  string,
  Partial<Record<Exclude<AppLanguage, 'en'>, { name: string; description: string }>>
> = {
  plumbing: {
    si: {
      name: 'ජලනල කටයුතු',
      description: 'කාන්දු, අවහිර වූ කාණු, ජල කරාම, නල සහ නානකාමර සවිකිරීම්.',
    },
    ta: {
      name: 'குழாய் வேலை',
      description: 'கசிவு, அடைப்பு, குழாய்கள் மற்றும் குளியலறை பொருத்தல்கள்.',
    },
  },
  electrical: {
    si: {
      name: 'විදුලි කටයුතු',
      description: 'රැහැන් ගැසීම, ප්ලග්, ස්විච්, ආලෝකකරණය සහ විදුලි දෝෂ.',
    },
    ta: {
      name: 'மின் வேலை',
      description: 'வயரிங், சாக்கெட், சுவிட்ச், விளக்குகள் மற்றும் மின் கோளாறுகள்.',
    },
  },
  cleaning: {
    si: { name: 'පිරිසිදු කිරීම', description: 'පැයෙන් පැයට නිවාස සහ කාර්යාල පිරිසිදු කිරීම.' },
    ta: {
      name: 'சுத்தம் செய்தல்',
      description: 'மணிநேர அடிப்படையில் வீடு மற்றும் அலுவலக சுத்தம்.',
    },
  },
  'ac-repair': {
    si: {
      name: 'වායු සමීකරණ අලුත්වැඩියා',
      description: 'වායු සමීකරණ සේවා, ගෑස් පිරවීම සහ අලුත්වැඩියා.',
    },
    ta: {
      name: 'ஏசி பழுதுபார்ப்பு',
      description: 'ஏசி பராமரிப்பு, வாயு நிரப்புதல் மற்றும் பழுதுபார்ப்பு.',
    },
  },
  carpentry: {
    si: {
      name: 'වඩු කර්මාන්තය',
      description: 'ගෘහ භාණ්ඩ අලුත්වැඩියා, සවිකිරීම් සහ ඇණවුම් දැව වැඩ.',
    },
    ta: { name: 'தச்சு வேலை', description: 'தளபாட பழுது, பொருத்துதல் மற்றும் தனிப்பயன் மரவேலை.' },
  },
};

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

export interface CatalogueSeedResult {
  categories: number;
  translations: number;
  cityLinks: number;
}

/**
 * Seeds the example catalogue end to end: the categories, a description for any
 * that lack one, Sinhala/Tamil translations, and each category's availability in
 * Colombo. Idempotent, and never overwrites anything already present.
 *
 * Colombo itself is reference data created by a migration, so it must exist.
 */
export async function seedCatalogue(
  db: Database,
  citySlug = 'colombo',
): Promise<CatalogueSeedResult> {
  const categories = await seedServiceCategories(db);

  const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, citySlug));
  if (!city) {
    throw new Error(`City "${citySlug}" does not exist. Run "npm run db:migrate" first.`);
  }

  // Descriptions were added after the first seed existed: fill only the blanks.
  for (const category of devServiceCategories) {
    await db
      .update(serviceCategories)
      .set({ description: category.description })
      .where(and(eq(serviceCategories.slug, category.slug), isNull(serviceCategories.description)));
  }

  const rows = await db
    .select({ id: serviceCategories.id, slug: serviceCategories.slug })
    .from(serviceCategories)
    .where(
      sql`${serviceCategories.slug} in (${sql.join(
        devServiceCategories.map((c) => sql`${c.slug}`),
        sql`, `,
      )})`,
    );
  const idBySlug = new Map(rows.map((row) => [row.slug, row.id]));

  const translationRows = Object.entries(devCategoryTranslations).flatMap(([slug, byLanguage]) =>
    Object.entries(byLanguage).flatMap(([language, text]) => {
      const serviceCategoryId = idBySlug.get(slug);
      return serviceCategoryId
        ? [{ serviceCategoryId, language: language as AppLanguage, ...text }]
        : [];
    }),
  );
  const translations = await db
    .insert(serviceCategoryTranslations)
    .values(translationRows)
    .onConflictDoNothing()
    .returning({ id: serviceCategoryTranslations.id });

  const cityLinks = await db
    .insert(cityCategories)
    .values(
      [...idBySlug.values()].map((serviceCategoryId) => ({ cityId: city.id, serviceCategoryId })),
    )
    .onConflictDoNothing()
    .returning({ id: cityCategories.id });

  return { categories, translations: translations.length, cityLinks: cityLinks.length };
}
