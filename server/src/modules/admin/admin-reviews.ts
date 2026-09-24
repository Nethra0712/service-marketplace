import type { Review } from '../../db/schema/index.js';
import type {
  AdminReviewFilter,
  AdminReviewRow,
  ReviewsService,
} from '../../modules/reviews/index.js';
import type { AuditLogService } from './audit-log.service.js';

export interface AdminReviewsServiceDeps {
  reviews: ReviewsService;
  audit: AuditLogService;
}

/**
 * Admin visibility into reviews plus "basic moderation controls": hiding a
 * review from the public rating. Never edits `rating` or `comment` — see
 * `reviews.service.ts`'s `hideReview` doc comment on why that would be
 * silently altering what a participant actually said, which the brief for
 * this sprint explicitly rules out.
 */
export function createAdminReviewsService({ reviews, audit }: AdminReviewsServiceDeps) {
  return {
    list: (filter: AdminReviewFilter): Promise<AdminReviewRow[]> => reviews.listForAdmin(filter),

    async hide(adminUserId: string, reviewId: string, reason: string | null): Promise<Review> {
      const hidden = await reviews.hideReview(reviewId, adminUserId, reason);
      await audit.record({
        adminUserId,
        action: 'review_hidden',
        targetType: 'review',
        targetId: reviewId,
        details: { reason },
      });
      return hidden;
    },
  };
}

export type AdminReviewsService = ReturnType<typeof createAdminReviewsService>;
