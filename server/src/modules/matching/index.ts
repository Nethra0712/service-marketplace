import {
  createMatchingService,
  type DispatchCandidateLookup,
  type MatchingService,
} from './matching.service.js';

export type {
  DispatchOffering,
  DispatchCandidate,
  JobLocation,
  RankedCandidate,
  MatchingService,
} from './matching.service.js';
export { WAVE_SIZE } from './matching.service.js';

export interface MatchingModuleDeps {
  /** From the providers module: everyone currently eligible for a fresh offer. */
  findDispatchCandidates: DispatchCandidateLookup;
}

export interface MatchingModule {
  service: MatchingService;
}

/** The matching module's public surface. Has no routes of its own: bookings drives it internally. */
export function createMatchingModule({
  findDispatchCandidates,
}: MatchingModuleDeps): MatchingModule {
  return { service: createMatchingService({ findDispatchCandidates }) };
}
