import type { Database } from '../../db/client.js';
import type { ProviderServiceStatus, ProviderVerificationStatus } from '../../db/schema/index.js';
import type { Clock } from '../../lib/clock.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import { blankToNull } from '../../lib/text.js';
import { createProvidersRepository } from './providers.repository.js';

/**
 * Which states a category application may move FROM for each reviewer decision.
 * `pending` is not a reviewer decision: only the provider re-opens an
 * application, and only from `rejected`.
 */
export const APPLICATION_TRANSITIONS = {
  approved: ['pending', 'rejected', 'suspended'],
  rejected: ['pending'],
  suspended: ['approved'],
} as const satisfies Record<string, readonly ProviderServiceStatus[]>;

export const PROFILE_TRANSITIONS = {
  verified: ['submitted', 'rejected'],
  rejected: ['submitted'],
} as const satisfies Record<string, readonly ProviderVerificationStatus[]>;

export type ApplicationDecision = keyof typeof APPLICATION_TRANSITIONS;
export type ProfileDecision = keyof typeof PROFILE_TRANSITIONS;

const MAX_NOTE_LENGTH = 500;
const cleanNote = (note: string | undefined): string | null =>
  blankToNull(note?.trim().slice(0, MAX_NOTE_LENGTH));

/**
 * REVIEWER OPERATIONS: approve, reject and suspend providers and their category
 * applications.
 *
 * Nothing in the HTTP layer calls this. It exists so the state machine is
 * implemented and tested now, and so the admin tooling built later can expose
 * it behind admin authentication without re-deriving the rules. Today it is
 * used only by tests and the development-only `npm run dev:review` script.
 */
export function createReviewService({ db, clock }: { db: Database; clock: Clock }) {
  const repository = createProvidersRepository(db);

  return {
    async reviewApplication(input: {
      applicationId: string;
      decision: ApplicationDecision;
      note?: string;
    }): Promise<void> {
      const changed = await repository.transitionApplication(
        input.applicationId,
        input.decision,
        APPLICATION_TRANSITIONS[input.decision],
        cleanNote(input.note),
        clock(),
      );
      if (changed) return;

      if (!(await repository.applicationExists(input.applicationId))) {
        throw new AppError(404, ErrorCode.NotFound, 'Application not found.');
      }
      throw new AppError(
        409,
        ErrorCode.InvalidState,
        `An application cannot be moved to "${input.decision}" from its current state.`,
      );
    },

    async reviewProfile(input: {
      providerProfileId: string;
      decision: ProfileDecision;
      note?: string;
    }): Promise<void> {
      const changed = await repository.transitionProfile(
        input.providerProfileId,
        input.decision,
        PROFILE_TRANSITIONS[input.decision],
        cleanNote(input.note),
        clock(),
      );
      if (changed) return;

      if (!(await repository.findProfileById(input.providerProfileId))) {
        throw new AppError(404, ErrorCode.NotFound, 'Provider profile not found.');
      }
      throw new AppError(
        409,
        ErrorCode.InvalidState,
        `A provider cannot be moved to "${input.decision}" from their current state.`,
      );
    },
  };
}

export type ReviewService = ReturnType<typeof createReviewService>;
