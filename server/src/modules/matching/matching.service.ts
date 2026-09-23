/** A category offered in a city — matches `providers.OfferedService`, kept local to avoid a hard type dependency. */
export interface DispatchOffering {
  serviceCategoryId: string;
  cityId: string;
}

/** A provider eligible for dispatch, with the raw inputs ranking needs. Matches `providers.DispatchCandidate`. */
export interface DispatchCandidate {
  providerProfileId: string;
  lastLatitude: string | null;
  lastLongitude: string | null;
  pendingOfferCount: number;
}

export interface JobLocation {
  latitude: number;
  longitude: number;
}

export interface RankedCandidate {
  providerProfileId: string;
  /** Straight-line distance in km, or null if either location is unknown. */
  distanceKm: number | null;
}

/** From the providers module: everyone currently eligible for a fresh offer on `offering`. */
export type DispatchCandidateLookup = (
  offering: DispatchOffering,
  excludeProviderProfileIds: readonly string[],
) => Promise<DispatchCandidate[]>;

/** How many providers one dispatch wave offers to. */
export const WAVE_SIZE = 3;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

function haversineKm(a: JobLocation, b: JobLocation): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Deterministic ranking: closest first, then lightest current workload
 * (fewest other pending offers), then provider id as a final, stable
 * tie-break. No rating factor: this app has no rating system yet.
 *
 * "Approval status" and "provider status" are not scored here because they
 * are already gates, not ranks — {@link DispatchCandidate} only ever contains
 * providers who passed them (see `providers.repository.ts#listDispatchCandidates`).
 */
export function rankCandidates(
  candidates: readonly DispatchCandidate[],
  jobLocation: JobLocation | null,
): RankedCandidate[] {
  const ranked = candidates.map((c) => ({
    providerProfileId: c.providerProfileId,
    distanceKm:
      jobLocation && c.lastLatitude !== null && c.lastLongitude !== null
        ? haversineKm(jobLocation, {
            latitude: Number(c.lastLatitude),
            longitude: Number(c.lastLongitude),
          })
        : null,
    pendingOfferCount: c.pendingOfferCount,
  }));

  ranked.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm !== null) return 1;
    if (a.distanceKm !== null && b.distanceKm === null) return -1;
    if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    if (a.pendingOfferCount !== b.pendingOfferCount) {
      return a.pendingOfferCount - b.pendingOfferCount;
    }
    return a.providerProfileId < b.providerProfileId
      ? -1
      : a.providerProfileId > b.providerProfileId
        ? 1
        : 0;
  });

  return ranked.map(({ providerProfileId, distanceKm }) => ({ providerProfileId, distanceKm }));
}

export interface MatchingServiceDeps {
  findDispatchCandidates: DispatchCandidateLookup;
}

/**
 * Automatic provider matching. Owns only eligibility (via the injected
 * lookup, which is the providers module's own bookable-provider rule plus
 * dispatch-specific filters — see its doc comment) and ranking. Never touches
 * a booking or an offer row; the bookings module decides what to do with the
 * candidates this returns.
 */
export function createMatchingService({ findDispatchCandidates }: MatchingServiceDeps) {
  return {
    /**
     * The next wave to offer: the best `waveSize` currently-eligible
     * candidates who are not in `excludeProviderProfileIds` (typically,
     * everyone already offered this booking in an earlier wave). "Expanding
     * the search" between waves means moving further down this ranking, not
     * loosening the eligibility rule itself.
     */
    findNextWave: async (
      offering: DispatchOffering,
      excludeProviderProfileIds: readonly string[],
      jobLocation: JobLocation | null,
      waveSize: number = WAVE_SIZE,
    ): Promise<RankedCandidate[]> => {
      const candidates = await findDispatchCandidates(offering, excludeProviderProfileIds);
      return rankCandidates(candidates, jobLocation).slice(0, waveSize);
    },
  };
}

export type MatchingService = ReturnType<typeof createMatchingService>;
