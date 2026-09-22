import { and, asc, count, countDistinct, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { Queryable } from '../../db/client.js';
import {
  cities,
  cityCategories,
  profiles,
  providerProfiles,
  providerServices,
  serviceCategories,
  serviceCategoryTranslations,
  users,
  type AppLanguage,
  type PricingModel,
  type ProviderAvailability,
  type ProviderServiceStatus,
  type ProviderVerificationStatus,
} from '../../db/schema/index.js';

export interface ProviderProfileRow {
  id: string;
  userId: string;
  /** The account's shared name (`profiles.full_name`). */
  fullName: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  verificationStatus: ProviderVerificationStatus;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  availability: ProviderAvailability;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationRow {
  id: string;
  status: ProviderServiceStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  pricingModel: PricingModel;
  citySlug: string;
  cityName: string;
}

export interface BookableProviderService {
  providerServiceId: string;
  providerProfileId: string;
  serviceCategoryId: string;
  cityId: string;
}

export interface BookableFilter {
  serviceCategoryId?: string | undefined;
  cityId?: string | undefined;
  citySlug?: string | undefined;
}

/** A category offered in a city, both currently active. */
export interface OfferedService {
  serviceCategoryId: string;
  cityId: string;
}

/**
 * All provider data access. Takes a `Queryable` so a service can run several
 * calls on one transaction.
 */
export function createProvidersRepository(db: Queryable) {
  const profileColumns = {
    id: providerProfiles.id,
    userId: providerProfiles.userId,
    fullName: profiles.fullName,
    bio: providerProfiles.bio,
    yearsOfExperience: providerProfiles.yearsOfExperience,
    verificationStatus: providerProfiles.verificationStatus,
    submittedAt: providerProfiles.submittedAt,
    reviewedAt: providerProfiles.reviewedAt,
    reviewNote: providerProfiles.reviewNote,
    availability: providerProfiles.availability,
    createdAt: providerProfiles.createdAt,
    updatedAt: providerProfiles.updatedAt,
  };

  const selectProfiles = () =>
    db
      .select(profileColumns)
      .from(providerProfiles)
      .leftJoin(profiles, eq(profiles.userId, providerProfiles.userId));

  function selectApplications(language: AppLanguage) {
    return db
      .select({
        id: providerServices.id,
        status: providerServices.status,
        reviewNote: providerServices.reviewNote,
        reviewedAt: providerServices.reviewedAt,
        createdAt: providerServices.createdAt,
        updatedAt: providerServices.updatedAt,
        categoryId: serviceCategories.id,
        categorySlug: serviceCategories.slug,
        categoryName: sql<string>`coalesce(${serviceCategoryTranslations.name}, ${serviceCategories.name})`,
        pricingModel: serviceCategories.pricingModel,
        citySlug: cities.slug,
        cityName: cities.name,
      })
      .from(providerServices)
      .innerJoin(serviceCategories, eq(serviceCategories.id, providerServices.serviceCategoryId))
      .innerJoin(cities, eq(cities.id, providerServices.cityId))
      .leftJoin(
        serviceCategoryTranslations,
        and(
          eq(serviceCategoryTranslations.serviceCategoryId, serviceCategories.id),
          eq(serviceCategoryTranslations.language, language),
        ),
      );
  }

  /**
   * THE rule for "can a customer be matched with / book this provider service".
   * A service is bookable only when ALL of these hold:
   *   - the category application is `approved` (per category and per city),
   *   - the provider as a person is `verified`,
   *   - the account is active and not deleted,
   *   - the category, the city, and the city's offering of that category are active.
   * Booking and matching must go through this and never re-implement it.
   */
  function bookableBase() {
    return db
      .select({
        providerServiceId: providerServices.id,
        providerProfileId: providerServices.providerProfileId,
        serviceCategoryId: providerServices.serviceCategoryId,
        cityId: providerServices.cityId,
      })
      .from(providerServices)
      .innerJoin(providerProfiles, eq(providerProfiles.id, providerServices.providerProfileId))
      .innerJoin(users, eq(users.id, providerProfiles.userId))
      .innerJoin(serviceCategories, eq(serviceCategories.id, providerServices.serviceCategoryId))
      .innerJoin(cities, eq(cities.id, providerServices.cityId))
      .innerJoin(
        cityCategories,
        and(
          eq(cityCategories.cityId, providerServices.cityId),
          eq(cityCategories.serviceCategoryId, providerServices.serviceCategoryId),
        ),
      );
  }

  function bookableConditions(filter: BookableFilter) {
    return and(
      eq(providerServices.status, 'approved'),
      eq(providerProfiles.verificationStatus, 'verified'),
      eq(users.status, 'active'),
      isNull(users.deletedAt),
      eq(serviceCategories.isActive, true),
      eq(cities.isActive, true),
      eq(cityCategories.isActive, true),
      filter.serviceCategoryId === undefined
        ? undefined
        : eq(providerServices.serviceCategoryId, filter.serviceCategoryId),
      filter.cityId === undefined ? undefined : eq(providerServices.cityId, filter.cityId),
      filter.citySlug === undefined ? undefined : eq(cities.slug, filter.citySlug),
    );
  }

  return {
    // ---- profile -------------------------------------------------------

    async findProfileByUserId(userId: string): Promise<ProviderProfileRow | undefined> {
      const [row] = await selectProfiles().where(eq(providerProfiles.userId, userId));
      return row;
    },

    async findProfileById(id: string): Promise<ProviderProfileRow | undefined> {
      const [row] = await selectProfiles().where(eq(providerProfiles.id, id));
      return row;
    },

    /** Sets the account's shared name, creating the profile row if the user has none yet. */
    async upsertFullName(userId: string, fullName: string): Promise<void> {
      await db
        .insert(profiles)
        .values({ userId, fullName })
        .onConflictDoUpdate({ target: profiles.userId, set: { fullName } });
    },

    /**
     * Creates the provider profile or updates the provider-supplied fields.
     * Never touches verification state: that only changes through submit/review.
     */
    async upsertProfile(
      userId: string,
      values: { bio: string | null; yearsOfExperience: number | null },
    ): Promise<void> {
      await db
        .insert(providerProfiles)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: providerProfiles.userId, set: values });
    },

    /** draft/rejected -> submitted. Returns false if the profile was in any other state. */
    async markSubmitted(profileId: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(providerProfiles)
        .set({
          verificationStatus: 'submitted',
          submittedAt: now,
          reviewedAt: null,
          reviewNote: null,
        })
        .where(
          and(
            eq(providerProfiles.id, profileId),
            inArray(providerProfiles.verificationStatus, ['draft', 'rejected']),
          ),
        )
        .returning({ id: providerProfiles.id });
      return updated.length === 1;
    },

    /** Reviewer decision on the provider. Returns false if not currently in one of `from`. */
    async transitionProfile(
      profileId: string,
      to: 'verified' | 'rejected',
      from: readonly ProviderVerificationStatus[],
      note: string | null,
      now: Date,
    ): Promise<boolean> {
      const updated = await db
        .update(providerProfiles)
        .set({ verificationStatus: to, reviewedAt: now, reviewNote: note })
        .where(
          and(
            eq(providerProfiles.id, profileId),
            inArray(providerProfiles.verificationStatus, [...from]),
          ),
        )
        .returning({ id: providerProfiles.id });
      return updated.length === 1;
    },

    // ---- applications ---------------------------------------------------

    async countApplications(profileId: string): Promise<number> {
      const [row] = await db
        .select({ total: count() })
        .from(providerServices)
        .where(eq(providerServices.providerProfileId, profileId));
      return row?.total ?? 0;
    },

    async listApplications(profileId: string, language: AppLanguage): Promise<ApplicationRow[]> {
      return selectApplications(language)
        .where(eq(providerServices.providerProfileId, profileId))
        .orderBy(desc(providerServices.createdAt), asc(providerServices.id));
    },

    /** One application, only if it belongs to `profileId` (ownership is part of the lookup). */
    async findApplication(
      profileId: string,
      applicationId: string,
      language: AppLanguage,
    ): Promise<ApplicationRow | undefined> {
      const [row] = await selectApplications(language).where(
        and(
          eq(providerServices.id, applicationId),
          eq(providerServices.providerProfileId, profileId),
        ),
      );
      return row;
    },

    /** The category/city pair, if the category is active and currently offered in that active city. */
    async findOfferedService(
      categorySlug: string,
      citySlug: string,
    ): Promise<OfferedService | undefined> {
      const [row] = await db
        .select({ serviceCategoryId: serviceCategories.id, cityId: cities.id })
        .from(cityCategories)
        .innerJoin(serviceCategories, eq(serviceCategories.id, cityCategories.serviceCategoryId))
        .innerJoin(cities, eq(cities.id, cityCategories.cityId))
        .where(
          and(
            eq(serviceCategories.slug, categorySlug),
            eq(cities.slug, citySlug),
            eq(serviceCategories.isActive, true),
            eq(cities.isActive, true),
            eq(cityCategories.isActive, true),
          ),
        );
      return row;
    },

    async insertApplication(profileId: string, offering: OfferedService): Promise<{ id: string }> {
      const [row] = await db
        .insert(providerServices)
        .values({
          providerProfileId: profileId,
          serviceCategoryId: offering.serviceCategoryId,
          cityId: offering.cityId,
        })
        .returning({ id: providerServices.id });
      if (!row) throw new Error('Application insert returned no row');
      return row;
    },

    async applicationOwnedBy(profileId: string, applicationId: string): Promise<boolean> {
      const [row] = await db
        .select({ id: providerServices.id })
        .from(providerServices)
        .where(
          and(
            eq(providerServices.id, applicationId),
            eq(providerServices.providerProfileId, profileId),
          ),
        );
      return row !== undefined;
    },

    /** The provider re-applies after a rejection: rejected -> pending. */
    async reopenApplication(profileId: string, applicationId: string): Promise<boolean> {
      const updated = await db
        .update(providerServices)
        .set({ status: 'pending', reviewedAt: null, reviewNote: null })
        .where(
          and(
            eq(providerServices.id, applicationId),
            eq(providerServices.providerProfileId, profileId),
            eq(providerServices.status, 'rejected'),
          ),
        )
        .returning({ id: providerServices.id });
      return updated.length === 1;
    },

    /** Withdraw an application that has not been approved. */
    async deleteWithdrawableApplication(
      profileId: string,
      applicationId: string,
    ): Promise<boolean> {
      const deleted = await db
        .delete(providerServices)
        .where(
          and(
            eq(providerServices.id, applicationId),
            eq(providerServices.providerProfileId, profileId),
            inArray(providerServices.status, ['pending', 'rejected']),
          ),
        )
        .returning({ id: providerServices.id });
      return deleted.length === 1;
    },

    async applicationExists(applicationId: string): Promise<boolean> {
      const [row] = await db
        .select({ id: providerServices.id })
        .from(providerServices)
        .where(eq(providerServices.id, applicationId));
      return row !== undefined;
    },

    /** Reviewer decision on one application. Returns false if not currently in one of `from`. */
    async transitionApplication(
      applicationId: string,
      to: ProviderServiceStatus,
      from: readonly ProviderServiceStatus[],
      note: string | null,
      now: Date,
    ): Promise<boolean> {
      const updated = await db
        .update(providerServices)
        .set({ status: to, reviewedAt: now, reviewNote: note })
        .where(
          and(eq(providerServices.id, applicationId), inArray(providerServices.status, [...from])),
        )
        .returning({ id: providerServices.id });
      return updated.length === 1;
    },

    // ---- bookable providers ----------------------------------------------

    async listBookable(filter: BookableFilter): Promise<BookableProviderService[]> {
      return bookableBase()
        .where(bookableConditions(filter))
        .orderBy(asc(providerServices.createdAt));
    },

    /** Distinct providers who can currently be booked for the filter. */
    async countBookableProviders(filter: BookableFilter): Promise<number> {
      // Counts over the very same query as listBookable, so the two can never disagree.
      const bookable = bookableBase().where(bookableConditions(filter)).as('bookable');
      const [row] = await db
        .select({ total: countDistinct(bookable.providerProfileId) })
        .from(bookable);
      return row?.total ?? 0;
    },

    async isBookable(providerProfileId: string, offering: OfferedService): Promise<boolean> {
      const rows = await bookableBase()
        .where(
          and(
            bookableConditions({
              serviceCategoryId: offering.serviceCategoryId,
              cityId: offering.cityId,
            }),
            eq(providerServices.providerProfileId, providerProfileId),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
  };
}

export type ProvidersRepository = ReturnType<typeof createProvidersRepository>;
