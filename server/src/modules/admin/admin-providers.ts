import { and, desc, eq, ilike, or } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  profiles,
  providerProfiles,
  providerServices,
  serviceCategories,
  users,
  type ProviderServiceStatus,
  type ProviderVerificationStatus,
} from '../../db/schema/index.js';
import type {
  ApplicationDecision,
  ProfileDecision,
  ReviewService,
} from '../../modules/providers/index.js';
import type { AuditLogService } from './audit-log.service.js';

export interface AdminProviderRow {
  id: string;
  userId: string;
  fullName: string | null;
  phoneE164: string;
  verificationStatus: ProviderVerificationStatus;
  submittedAt: Date | null;
  createdAt: Date;
}

export interface AdminProviderApplicationRow {
  id: string;
  status: ProviderServiceStatus;
  reviewNote: string | null;
  categoryName: string;
  createdAt: Date;
}

export interface AdminProvidersServiceDeps {
  db: Database;
  review: ReviewService;
  audit: AuditLogService;
}

/**
 * Admin-side provider visibility and moderation. The actual approve/reject/
 * suspend rules live in `providers/review.service.ts` (built in an earlier
 * sprint specifically for this — see its own doc comment); this module only
 * adds admin authorization, listing/search, and an audit trail around it.
 */
export function createAdminProvidersService({ db, review, audit }: AdminProvidersServiceDeps) {
  return {
    async list(filter: {
      search?: string | undefined;
      verificationStatus?: ProviderVerificationStatus | undefined;
      limit: number;
    }): Promise<AdminProviderRow[]> {
      const conditions = [
        filter.verificationStatus
          ? eq(providerProfiles.verificationStatus, filter.verificationStatus)
          : undefined,
        filter.search
          ? or(
              ilike(profiles.fullName, `%${filter.search}%`),
              ilike(users.phoneE164, `%${filter.search}%`),
            )
          : undefined,
      ].filter((c) => c !== undefined);

      return db
        .select({
          id: providerProfiles.id,
          userId: providerProfiles.userId,
          fullName: profiles.fullName,
          phoneE164: users.phoneE164,
          verificationStatus: providerProfiles.verificationStatus,
          submittedAt: providerProfiles.submittedAt,
          createdAt: providerProfiles.createdAt,
        })
        .from(providerProfiles)
        .innerJoin(users, eq(users.id, providerProfiles.userId))
        .leftJoin(profiles, eq(profiles.userId, providerProfiles.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(providerProfiles.createdAt))
        .limit(filter.limit);
    },

    async getDetail(
      providerProfileId: string,
    ): Promise<
      { provider: AdminProviderRow; applications: AdminProviderApplicationRow[] } | undefined
    > {
      const [provider] = await db
        .select({
          id: providerProfiles.id,
          userId: providerProfiles.userId,
          fullName: profiles.fullName,
          phoneE164: users.phoneE164,
          verificationStatus: providerProfiles.verificationStatus,
          submittedAt: providerProfiles.submittedAt,
          createdAt: providerProfiles.createdAt,
        })
        .from(providerProfiles)
        .innerJoin(users, eq(users.id, providerProfiles.userId))
        .leftJoin(profiles, eq(profiles.userId, providerProfiles.userId))
        .where(eq(providerProfiles.id, providerProfileId));
      if (!provider) return undefined;

      const applications = await db
        .select({
          id: providerServices.id,
          status: providerServices.status,
          reviewNote: providerServices.reviewNote,
          categoryName: serviceCategories.name,
          createdAt: providerServices.createdAt,
        })
        .from(providerServices)
        .innerJoin(serviceCategories, eq(serviceCategories.id, providerServices.serviceCategoryId))
        .where(eq(providerServices.providerProfileId, providerProfileId))
        .orderBy(desc(providerServices.createdAt));

      return { provider, applications };
    },

    async reviewApplication(
      adminUserId: string,
      applicationId: string,
      decision: ApplicationDecision,
      note?: string,
    ): Promise<void> {
      await review.reviewApplication({ applicationId, decision, note });
      await audit.record({
        adminUserId,
        action: 'provider_application_reviewed',
        targetType: 'provider_application',
        targetId: applicationId,
        details: { decision, note: note ?? null },
      });
    },

    async reviewProfile(
      adminUserId: string,
      providerProfileId: string,
      decision: ProfileDecision,
      note?: string,
    ): Promise<void> {
      await review.reviewProfile({ providerProfileId, decision, note });
      await audit.record({
        adminUserId,
        action: 'provider_profile_reviewed',
        targetType: 'provider_profile',
        targetId: providerProfileId,
        details: { decision, note: note ?? null },
      });
    },
  };
}

export type AdminProvidersService = ReturnType<typeof createAdminProvidersService>;
