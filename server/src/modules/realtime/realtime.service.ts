import type { Clock } from '../../lib/clock.js';
import type { LocationUpdatePayload } from './realtime.schemas.js';

/** A booking stage during which a provider's location is meaningful to share. */
const TRACKABLE_STATUSES = ['accepted', 'en_route', 'arrived', 'in_progress'] as const;
type TrackableStatus = (typeof TRACKABLE_STATUSES)[number];

/** How often one booking accepts a new location update. Extra updates are dropped, not queued. */
export const MIN_UPDATE_INTERVAL_MS = 3_000;

export type BookingRole = 'customer' | 'provider';

/** The subset of a booking's state this module needs, however it is spelled by whoever provides it. */
export interface BookingAccess {
  customerId: string;
  providerProfileId: string | null;
  status: string;
}

/** From the bookings module. Undefined for a booking that does not exist. */
export type BookingAccessLookup = (bookingId: string) => Promise<BookingAccess | undefined>;

/** From the providers module: the caller's own provider profile id, if they have one. */
export type ProviderProfileLookup = (userId: string) => Promise<string | undefined>;

export interface CachedLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracyMeters: number | null;
  at: Date;
}

export type AcceptUpdateResult =
  | { error: 'NOT_FOUND' | 'NOT_TRACKABLE' | 'RATE_LIMITED' }
  | { error?: undefined; location: CachedLocation };

export interface RealtimeServiceDeps {
  findBookingAccess: BookingAccessLookup;
  findProviderProfileId: ProviderProfileLookup;
  clock: Clock;
}

const isTrackable = (status: string): status is TrackableStatus =>
  (TRACKABLE_STATUSES as readonly string[]).includes(status);

/**
 * The room-authorization and location-update rules behind the realtime
 * module, kept free of Socket.IO itself so they can be unit tested directly
 * and so the transport can change without this logic moving.
 *
 * Holds only an in-memory, per-booking "latest location" snapshot — never a
 * history. It exists purely to hand a just-joined (or just-reconnected)
 * socket the current point instead of leaving it blank until the next GPS
 * fix, and it is gone the moment the booking is no longer trackable or the
 * process restarts. Nothing here is written to a database table.
 */
export function createRealtimeService({
  findBookingAccess,
  findProviderProfileId,
  clock,
}: RealtimeServiceDeps) {
  const lastLocationByBooking = new Map<string, CachedLocation>();
  const lastAcceptedAtByBooking = new Map<string, number>();

  function forget(bookingId: string): void {
    lastLocationByBooking.delete(bookingId);
    lastAcceptedAtByBooking.delete(bookingId);
  }

  return {
    /**
     * Whether `userId` may join `bookingId`'s room, and as which role.
     * Undefined for anyone who is not that booking's customer or its
     * assigned provider — a booking that does not exist looks exactly the
     * same as one that exists but is not theirs, so nobody can use this to
     * probe for a booking id's existence.
     */
    async authorizeRoom(
      bookingId: string,
      userId: string,
    ): Promise<{ role: BookingRole; status: string } | undefined> {
      const access = await findBookingAccess(bookingId);
      if (!access) return undefined;
      if (!isTrackable(access.status)) forget(bookingId);

      if (access.customerId === userId) return { role: 'customer', status: access.status };
      if (access.providerProfileId) {
        const myProviderProfileId = await findProviderProfileId(userId);
        if (myProviderProfileId && myProviderProfileId === access.providerProfileId) {
          return { role: 'provider', status: access.status };
        }
      }
      return undefined;
    },

    lastLocation: (bookingId: string): CachedLocation | undefined =>
      lastLocationByBooking.get(bookingId),

    /**
     * Validates and records a location update, only ever from the booking's
     * currently assigned provider while it is in a trackable stage, and only
     * as often as {@link MIN_UPDATE_INTERVAL_MS} allows. An update this
     * rejects is dropped outright: it is never queued or retried server-side.
     */
    async acceptUpdate(
      userId: string,
      payload: LocationUpdatePayload,
    ): Promise<AcceptUpdateResult> {
      const access = await findBookingAccess(payload.bookingId);
      // Unauthorized and nonexistent look the same, same reasoning as authorizeRoom.
      if (!access?.providerProfileId) return { error: 'NOT_FOUND' };
      const myProviderProfileId = await findProviderProfileId(userId);
      if (!myProviderProfileId || myProviderProfileId !== access.providerProfileId) {
        return { error: 'NOT_FOUND' };
      }

      if (!isTrackable(access.status)) {
        forget(payload.bookingId);
        return { error: 'NOT_TRACKABLE' };
      }

      const now = clock().getTime();
      const lastAcceptedAt = lastAcceptedAtByBooking.get(payload.bookingId);
      if (lastAcceptedAt !== undefined && now - lastAcceptedAt < MIN_UPDATE_INTERVAL_MS) {
        return { error: 'RATE_LIMITED' };
      }

      const location: CachedLocation = {
        latitude: payload.latitude,
        longitude: payload.longitude,
        heading: payload.heading ?? null,
        speed: payload.speed ?? null,
        accuracyMeters: payload.accuracyMeters ?? null,
        at: clock(),
      };
      lastLocationByBooking.set(payload.bookingId, location);
      lastAcceptedAtByBooking.set(payload.bookingId, now);
      return { location };
    },

    /** Drops whatever is held for a booking. Called once its outcome is known (completed, cancelled, released). */
    forget,
  };
}

export type RealtimeService = ReturnType<typeof createRealtimeService>;
