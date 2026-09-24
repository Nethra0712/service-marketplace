import { desc, eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  serviceCategories,
  type NewServiceCategory,
  type PricingModel,
  type ServiceCategory,
} from '../../db/schema/index.js';
import { isUniqueViolation } from '../../lib/db-errors.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import { blankToNull } from '../../lib/text.js';
import type { AuditLogService } from './audit-log.service.js';

export interface CategoryInput {
  slug: string;
  name: string;
  description?: string | null | undefined;
  pricingModel: PricingModel;
  /** Required for `fixed`/`hourly`, forbidden for `quote` — see `service-categories.ts`'s check constraint. */
  baseRate?: number | null | undefined;
}

export interface CategoryUpdate {
  name?: string | undefined;
  description?: string | null | undefined;
  pricingModel?: PricingModel | undefined;
  baseRate?: number | null | undefined;
  isActive?: boolean | undefined;
}

const notFound = () => new AppError(404, ErrorCode.NotFound, 'Service category not found.');
const slugTaken = () =>
  new AppError(409, ErrorCode.ValidationError, 'A category with that slug already exists.', {
    details: [{ path: 'slug', message: 'Already in use.' }],
  });
const rateMismatch = () =>
  new AppError(
    400,
    ErrorCode.ValidationError,
    'baseRate is required for fixed/hourly pricing and must be omitted for quote pricing.',
    { details: [{ path: 'baseRate', message: 'Does not match pricingModel.' }] },
  );

/** `baseRate` is required for fixed/hourly, forbidden for quote — the same rule `service_categories`' own check constraint enforces. */
function baseRateFor(
  pricingModel: PricingModel,
  baseRate: number | null | undefined,
): string | null {
  const required = pricingModel !== 'quote';
  if (required !== (baseRate !== null && baseRate !== undefined)) throw rateMismatch();
  return baseRate === null || baseRate === undefined ? null : baseRate.toFixed(2);
}

export interface AdminCategoriesServiceDeps {
  db: Database;
  audit: AuditLogService;
}

/** Admin CRUD for service categories. There is no public write path for these — see `catalogue.routes.ts`'s own doc comment (read-only, unauthenticated). */
export function createAdminCategoriesService({ db, audit }: AdminCategoriesServiceDeps) {
  const service = {
    list: (): Promise<ServiceCategory[]> =>
      db.select().from(serviceCategories).orderBy(desc(serviceCategories.createdAt)),

    async get(id: string): Promise<ServiceCategory> {
      const [row] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, id));
      if (!row) throw notFound();
      return row;
    },

    async create(adminUserId: string, input: CategoryInput): Promise<ServiceCategory> {
      const values: NewServiceCategory = {
        slug: input.slug.trim().toLowerCase(),
        name: input.name.trim(),
        description: blankToNull(input.description ?? undefined),
        pricingModel: input.pricingModel,
        baseRate: baseRateFor(input.pricingModel, input.baseRate),
      };
      let row: ServiceCategory | undefined;
      try {
        [row] = await db.insert(serviceCategories).values(values).returning();
      } catch (error) {
        if (isUniqueViolation(error, 'service_categories_slug_uidx')) throw slugTaken();
        throw error;
      }
      if (!row) throw new Error('Insert did not return a row.');

      await audit.record({
        adminUserId,
        action: 'category_created',
        targetType: 'service_category',
        targetId: row.id,
        details: { slug: row.slug, pricingModel: row.pricingModel },
      });
      return row;
    },

    async update(adminUserId: string, id: string, input: CategoryUpdate): Promise<ServiceCategory> {
      const existing = await service.get(id);
      const pricingModel = input.pricingModel ?? existing.pricingModel;
      const baseRateProvided = 'baseRate' in input;
      const baseRate = baseRateFor(
        pricingModel,
        baseRateProvided
          ? input.baseRate
          : existing.baseRate === null
            ? null
            : Number(existing.baseRate),
      );

      const [row] = await db
        .update(serviceCategories)
        .set({
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined
            ? { description: blankToNull(input.description ?? undefined) }
            : {}),
          pricingModel,
          baseRate,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        })
        .where(eq(serviceCategories.id, id))
        .returning();
      if (!row) throw notFound();

      await audit.record({
        adminUserId,
        action: 'category_updated',
        targetType: 'service_category',
        targetId: id,
        details: { ...input },
      });
      return row;
    },
  };
  return service;
}

export type AdminCategoriesService = ReturnType<typeof createAdminCategoriesService>;
