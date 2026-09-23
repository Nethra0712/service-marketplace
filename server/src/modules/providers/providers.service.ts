import type {
  AppLanguage,
  PricingModel,
  ProviderAvailability,
  ProviderServiceStatus,
  ProviderVerificationStatus,
} from '../../db/schema/index.js';
import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import { isUniqueViolation } from '../../lib/db-errors.js';
import { AppError, ErrorCode, type ErrorDetail } from '../../lib/errors.js';
import { blankToNull } from '../../lib/text.js';
import {
  createProvidersRepository,
  type ApplicationRow,
  type BookableFilter,
  type DispatchCandidate,
  type OfferedService,
  type ProviderProfileRow,
} from './providers.repository.js';

/** What a provider sees about their own profile. */
export interface ProviderProfileView {
  id: string;
  fullName: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  verificationStatus: ProviderVerificationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** The reviewer's reason, e.g. why the profile was rejected. */
  reviewNote: string | null;
  availability: ProviderAvailability;
  createdAt: string;
  updatedAt: string;
}

/** What a provider sees about one of their category applications. */
export interface ApplicationView {
  id: string;
  status: ProviderServiceStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  category: { id: string; slug: string; name: string; pricingModel: PricingModel };
  city: { slug: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface SaveProfileInput {
  fullName: string;
  bio?: string | null | undefined;
  yearsOfExperience?: number | null | undefined;
}

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

const toProfileView = (row: ProviderProfileRow): ProviderProfileView => ({
  id: row.id,
  fullName: row.fullName,
  bio: row.bio,
  yearsOfExperience: row.yearsOfExperience,
  verificationStatus: row.verificationStatus,
  submittedAt: iso(row.submittedAt),
  reviewedAt: iso(row.reviewedAt),
  reviewNote: row.reviewNote,
  availability: row.availability,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toApplicationView = (row: ApplicationRow): ApplicationView => ({
  id: row.id,
  status: row.status,
  reviewNote: row.reviewNote,
  reviewedAt: iso(row.reviewedAt),
  category: {
    id: row.categoryId,
    slug: row.categorySlug,
    name: row.categoryName,
    pricingModel: row.pricingModel,
  },
  city: { slug: row.citySlug, name: row.cityName },
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const notFound = (message: string) => new AppError(404, ErrorCode.NotFound, message);

export interface ProvidersServiceDeps {
  db: Database;
  clock: Clock;
}

/**
 * Provider self-service. Every method acts on the *caller's own* provider
 * profile, identified by the authenticated user id; there is no way to name
 * someone else's profile or application. Reviewer actions (approve, reject,
 * suspend) are deliberately absent here: they live in the review service, which
 * no HTTP route calls.
 */
export function createProvidersService({ db, clock }: ProvidersServiceDeps) {
  const repository = createProvidersRepository(db);

  async function requireProfile(userId: string): Promise<ProviderProfileRow> {
    const profile = await repository.findProfileByUserId(userId);
    if (!profile) {
      throw new AppError(
        404,
        ErrorCode.ProviderProfileNotFound,
        'You have no provider profile yet.',
      );
    }
    return profile;
  }

  /** The profile for the calling user, or a 409 telling them to create one first. */
  async function requireProfileForApplications(userId: string): Promise<ProviderProfileRow> {
    const profile = await repository.findProfileByUserId(userId);
    if (!profile) {
      throw new AppError(
        409,
        ErrorCode.ProviderProfileRequired,
        'Create your provider profile before applying for services.',
      );
    }
    return profile;
  }

  return {
    async getProfile(userId: string): Promise<ProviderProfileView> {
      return toProfileView(await requireProfile(userId));
    },

    /**
     * Creates the provider profile (this is how a user applies to become a
     * provider) or updates it. Sets the account's shared name. Never changes
     * verification state.
     */
    async saveProfile(
      userId: string,
      input: SaveProfileInput,
    ): Promise<{ profile: ProviderProfileView; created: boolean }> {
      return db.transaction(async (tx) => {
        const repo = createProvidersRepository(tx);
        const existing = await repo.findProfileByUserId(userId);

        await repo.upsertFullName(userId, input.fullName);
        await repo.upsertProfile(userId, {
          bio: blankToNull(input.bio),
          yearsOfExperience: input.yearsOfExperience ?? null,
        });

        const saved = await repo.findProfileByUserId(userId);
        if (!saved) throw new Error('Provider profile missing after save');
        return { profile: toProfileView(saved), created: existing === undefined };
      });
    },

    /**
     * Hands the profile in for review (draft or rejected -> submitted). Requires a
     * name and at least one service application, so a reviewer never opens an
     * empty profile.
     */
    async submitProfile(userId: string): Promise<ProviderProfileView> {
      const profile = await requireProfile(userId);

      if (profile.verificationStatus === 'submitted') {
        throw new AppError(409, ErrorCode.InvalidState, 'Your profile has already been submitted.');
      }
      if (profile.verificationStatus === 'verified') {
        throw new AppError(409, ErrorCode.InvalidState, 'Your profile is already verified.');
      }

      const missing: ErrorDetail[] = [];
      if (!profile.fullName?.trim()) {
        missing.push({ path: 'fullName', message: 'Enter your full name before submitting.' });
      }
      if ((await repository.countApplications(profile.id)) === 0) {
        missing.push({
          path: 'services',
          message: 'Apply for at least one service before submitting.',
        });
      }
      if (missing.length > 0) {
        throw new AppError(409, ErrorCode.ProfileIncomplete, 'Your profile is not complete.', {
          details: missing,
        });
      }

      if (!(await repository.markSubmitted(profile.id, clock()))) {
        // Someone (another request) moved it on between our read and write.
        throw new AppError(
          409,
          ErrorCode.InvalidState,
          'Your profile cannot be submitted right now.',
        );
      }
      return toProfileView(await requireProfile(userId));
    },

    async listApplications(userId: string, language: AppLanguage): Promise<ApplicationView[]> {
      const profile = await requireProfile(userId);
      return (await repository.listApplications(profile.id, language)).map(toApplicationView);
    },

    async getApplication(
      userId: string,
      applicationId: string,
      language: AppLanguage,
    ): Promise<ApplicationView> {
      const profile = await requireProfile(userId);
      // Scoped by owner: someone else's application is indistinguishable from a missing one.
      const row = await repository.findApplication(profile.id, applicationId, language);
      if (!row) throw notFound('Application not found.');
      return toApplicationView(row);
    },

    /** Apply for a category in a city. Approval is a separate, reviewer-only step. */
    async apply(
      userId: string,
      input: { categorySlug: string; citySlug: string },
      language: AppLanguage,
    ): Promise<ApplicationView> {
      const profile = await requireProfileForApplications(userId);

      const offering = await repository.findOfferedService(input.categorySlug, input.citySlug);
      if (!offering) throw notFound('That service is not available in this city.');

      let created: { id: string };
      try {
        created = await repository.insertApplication(profile.id, offering);
      } catch (error) {
        if (isUniqueViolation(error, 'provider_services_provider_category_city_uidx')) {
          throw new AppError(
            409,
            ErrorCode.AlreadyApplied,
            'You have already applied for this service in this city.',
          );
        }
        throw error;
      }
      return this.getApplication(userId, created.id, language);
    },

    /** After a rejection, apply again: rejected -> pending. */
    async resubmitApplication(
      userId: string,
      applicationId: string,
      language: AppLanguage,
    ): Promise<ApplicationView> {
      const profile = await requireProfile(userId);
      if (!(await repository.reopenApplication(profile.id, applicationId))) {
        if (!(await repository.applicationOwnedBy(profile.id, applicationId))) {
          throw notFound('Application not found.');
        }
        throw new AppError(
          409,
          ErrorCode.InvalidState,
          'Only a rejected application can be submitted again.',
        );
      }
      return this.getApplication(userId, applicationId, language);
    },

    /** Withdraw a pending or rejected application. Approved and suspended ones stay on record. */
    async withdrawApplication(userId: string, applicationId: string): Promise<void> {
      const profile = await requireProfile(userId);
      if (await repository.deleteWithdrawableApplication(profile.id, applicationId)) return;

      if (!(await repository.applicationOwnedBy(profile.id, applicationId))) {
        throw notFound('Application not found.');
      }
      throw new AppError(
        409,
        ErrorCode.InvalidState,
        'An approved or suspended application cannot be withdrawn.',
      );
    },

    /** The provider's own online/offline toggle. Requires an existing provider profile. */
    async setAvailability(
      userId: string,
      availability: ProviderAvailability,
    ): Promise<ProviderProfileView> {
      await requireProfile(userId);
      if (!(await repository.updateAvailability(userId, availability))) {
        throw notFound('You have no provider profile yet.');
      }
      return toProfileView(await requireProfile(userId));
    },

    /**
     * Reports the provider's current location, used only as a matching input
     * (see the `matching` module). Overwrites the previous value; no history is
     * kept. Requires an existing provider profile.
     */
    async setLocation(
      userId: string,
      location: { latitude: number; longitude: number },
    ): Promise<ProviderProfileView> {
      await requireProfile(userId);
      if (!(await repository.updateLocation(userId, location, clock()))) {
        throw notFound('You have no provider profile yet.');
      }
      return toProfileView(await requireProfile(userId));
    },

    /**
     * The caller's provider profile id, or undefined if they have none. Unlike
     * {@link getProfile} this never throws: callers (the bookings module) use it
     * to decide "is this person a provider at all" without an existence check
     * of their own.
     */
    findProviderProfileId: async (userId: string): Promise<string | undefined> =>
      (await repository.findProfileByUserId(userId))?.id,

    // ---- the bookable-provider gate (used by the catalogue and bookings modules) ----

    listBookableProviderServices: (filter: BookableFilter) => repository.listBookable(filter),
    countBookableProviders: (filter: BookableFilter) => repository.countBookableProviders(filter),
    isBookable: (providerProfileId: string, offering: OfferedService) =>
      repository.isBookable(providerProfileId, offering),
    listDispatchCandidates: (
      offering: OfferedService,
      excludeProviderProfileIds: readonly string[],
    ): Promise<DispatchCandidate[]> =>
      repository.listDispatchCandidates(offering, excludeProviderProfileIds),
  };
}

export type ProvidersService = ReturnType<typeof createProvidersService>;
