import { describe, expect, it } from 'vitest';

import {
  rankCandidates,
  type DispatchCandidate,
} from '../../src/modules/matching/matching.service.js';

const candidate = (overrides: Partial<DispatchCandidate>): DispatchCandidate => ({
  providerProfileId: 'p',
  lastLatitude: null,
  lastLongitude: null,
  pendingOfferCount: 0,
  ...overrides,
});

// Colombo Fort, roughly.
const JOB = { latitude: 6.9344, longitude: 79.8428 };
// A few kilometres away, further away, and much further away.
const NEAR = { latitude: 6.9271, longitude: 79.8612 }; // ~2km
const MID = { latitude: 6.9019, longitude: 79.8607 }; // ~4km
const FAR = { latitude: 7.2906, longitude: 80.6337 }; // Kandy, ~100km

describe('rankCandidates', () => {
  it('orders closer providers first when a job location is known', () => {
    const ranked = rankCandidates(
      [
        candidate({
          providerProfileId: 'far',
          lastLatitude: String(FAR.latitude),
          lastLongitude: String(FAR.longitude),
        }),
        candidate({
          providerProfileId: 'near',
          lastLatitude: String(NEAR.latitude),
          lastLongitude: String(NEAR.longitude),
        }),
        candidate({
          providerProfileId: 'mid',
          lastLatitude: String(MID.latitude),
          lastLongitude: String(MID.longitude),
        }),
      ],
      JOB,
    );

    expect(ranked.map((r) => r.providerProfileId)).toEqual(['near', 'mid', 'far']);
    const distances = ranked.map((r) => r.distanceKm);
    expect(distances[0]).not.toBeNull();
    expect(distances[1]).not.toBeNull();
    expect(distances[2]).not.toBeNull();
    expect(distances[0]).toBeLessThan(distances[1] ?? Infinity);
    expect(distances[1]).toBeLessThan(distances[2] ?? Infinity);
  });

  it('puts providers with an unknown location last, regardless of workload', () => {
    const ranked = rankCandidates(
      [
        candidate({ providerProfileId: 'unknown', pendingOfferCount: 0 }),
        candidate({
          providerProfileId: 'known',
          lastLatitude: String(FAR.latitude),
          lastLongitude: String(FAR.longitude),
          pendingOfferCount: 5,
        }),
      ],
      JOB,
    );

    expect(ranked.map((r) => r.providerProfileId)).toEqual(['known', 'unknown']);
    expect(ranked[1]?.distanceKm).toBeNull();
  });

  it('treats every distance as unknown when no job location is given', () => {
    const ranked = rankCandidates(
      [
        candidate({ providerProfileId: 'a', lastLatitude: '6.9', lastLongitude: '79.8' }),
        candidate({ providerProfileId: 'b', lastLatitude: '7.2', lastLongitude: '80.6' }),
      ],
      null,
    );

    expect(ranked.every((r) => r.distanceKm === null)).toBe(true);
  });

  it('breaks a distance tie by lighter current workload', () => {
    const ranked = rankCandidates(
      [
        candidate({ providerProfileId: 'busy', pendingOfferCount: 3 }),
        candidate({ providerProfileId: 'free', pendingOfferCount: 0 }),
      ],
      null, // both distances null -> tied on distance, decided by workload
    );

    expect(ranked.map((r) => r.providerProfileId)).toEqual(['free', 'busy']);
  });

  it('breaks a full tie by provider id, deterministically', () => {
    const a = candidate({ providerProfileId: 'aaaa' });
    const b = candidate({ providerProfileId: 'bbbb' });

    expect(rankCandidates([b, a], null).map((r) => r.providerProfileId)).toEqual(['aaaa', 'bbbb']);
    expect(rankCandidates([a, b], null).map((r) => r.providerProfileId)).toEqual(['aaaa', 'bbbb']);
  });

  it('is a total, stable ordering independent of input order', () => {
    const pool = [
      candidate({ providerProfileId: 'p3', pendingOfferCount: 1 }),
      candidate({ providerProfileId: 'p1', pendingOfferCount: 0 }),
      candidate({ providerProfileId: 'p2', pendingOfferCount: 0 }),
    ];
    const forward = rankCandidates(pool, null).map((r) => r.providerProfileId);
    const reversed = rankCandidates([...pool].reverse(), null).map((r) => r.providerProfileId);

    expect(forward).toEqual(reversed);
    expect(forward).toEqual(['p1', 'p2', 'p3']);
  });

  it('returns an empty ranking for an empty candidate pool', () => {
    expect(rankCandidates([], JOB)).toEqual([]);
  });
});
