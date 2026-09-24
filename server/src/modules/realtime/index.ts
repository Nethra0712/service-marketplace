import type { Server as HttpServer } from 'node:http';

import { Server as SocketIOServer, type Socket } from 'socket.io';

import type { AuthContext, Authenticator } from '../auth/index.js';
import type { Clock } from '../../lib/clock.js';
import type { Logger } from '../../lib/logger.js';
import {
  createRealtimeService,
  type BookingAccessLookup,
  type CachedLocation,
  type ProviderProfileLookup,
} from './realtime.service.js';
import { bookingRoomSchema, locationUpdateSchema } from './realtime.schemas.js';

export { MIN_UPDATE_INTERVAL_MS } from './realtime.service.js';
export type { BookingAccessLookup, BookingRole } from './realtime.service.js';

const roomName = (bookingId: string): string => `booking:${bookingId}`;

interface SocketData {
  auth: AuthContext;
}

/** A client may or may not pass an ack callback; calling a missing one would throw. */
type Ack<T> = ((payload: T) => void) | undefined;
function reply<T>(ack: Ack<T>, payload: T): void {
  if (typeof ack === 'function') ack(payload);
}

const serializeLocation = (location: CachedLocation) => ({
  latitude: location.latitude,
  longitude: location.longitude,
  heading: location.heading,
  speed: location.speed,
  accuracyMeters: location.accuracyMeters,
  at: location.at.toISOString(),
});

export interface RealtimeModuleDeps {
  httpServer: HttpServer;
  /** From the auth module: the same rule `requireAuth` uses, for the handshake token. */
  authenticate: Authenticator;
  /** From the bookings module. */
  findBookingAccess: BookingAccessLookup;
  /** From the providers module. */
  findProviderProfileId: ProviderProfileLookup;
  clock: Clock;
  logger: Logger;
  corsOrigins: string[];
}

export interface RealtimeModule {
  io: SocketIOServer;
  /** Drops whatever is held for a booking. The bookings module calls this once a booking's outcome is known. */
  forgetBooking: (bookingId: string) => void;
}

/**
 * Live provider-location delivery over Socket.IO. Mounted on the same HTTP
 * server as the REST API, not on a separate port. Every booking gets its own
 * room (`booking:<id>`); only that booking's customer or its currently
 * assigned provider may join it, and only that provider may publish location
 * updates into it — see `realtime.service.ts` for the actual rules.
 */
export function createRealtimeModule({
  httpServer,
  authenticate,
  findBookingAccess,
  findProviderProfileId,
  clock,
  logger,
  corsOrigins,
}: RealtimeModuleDeps): RealtimeModule {
  const service = createRealtimeService({ findBookingAccess, findProviderProfileId, clock });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: corsOrigins.length > 0 ? corsOrigins : false },
    // Keep the transport itself lean; the app protocol above this is what
    // actually rate-limits meaningful traffic (see MIN_UPDATE_INTERVAL_MS).
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // Handshake authentication: the same access token REST calls use, passed as
  // `auth: { token }` on the client. Anything else never reaches a handler.
  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('UNAUTHENTICATED'));
      return;
    }
    authenticate(token).then(
      (auth) => {
        (socket.data as SocketData).auth = auth;
        next();
      },
      () => {
        next(new Error('UNAUTHENTICATED'));
      },
    );
  });

  io.on('connection', (socket: Socket) => {
    const auth = (socket.data as SocketData).auth;

    socket.on('booking:join', (raw: unknown, ack?: Ack<object>) => {
      const parsed = bookingRoomSchema.safeParse(raw);
      if (!parsed.success) {
        reply(ack, { ok: false, error: 'VALIDATION_ERROR' });
        return;
      }
      void service.authorizeRoom(parsed.data.bookingId, auth.userId).then((authorized) => {
        if (!authorized) {
          reply(ack, { ok: false, error: 'NOT_FOUND' });
          return;
        }
        void socket.join(roomName(parsed.data.bookingId));
        const last = service.lastLocation(parsed.data.bookingId);
        reply(ack, {
          ok: true,
          role: authorized.role,
          status: authorized.status,
          lastLocation: last ? serializeLocation(last) : null,
        });
      });
    });

    socket.on('booking:leave', (raw: unknown, ack?: Ack<object>) => {
      const parsed = bookingRoomSchema.safeParse(raw);
      if (!parsed.success) {
        reply(ack, { ok: false, error: 'VALIDATION_ERROR' });
        return;
      }
      void socket.leave(roomName(parsed.data.bookingId));
      reply(ack, { ok: true });
    });

    socket.on('location:update', (raw: unknown, ack?: Ack<object>) => {
      const parsed = locationUpdateSchema.safeParse(raw);
      if (!parsed.success) {
        reply(ack, { ok: false, error: 'VALIDATION_ERROR' });
        return;
      }
      void service.acceptUpdate(auth.userId, parsed.data).then((result) => {
        if (result.error) {
          reply(ack, { ok: false, error: result.error });
          return;
        }
        socket.to(roomName(parsed.data.bookingId)).emit('location:update', {
          bookingId: parsed.data.bookingId,
          ...serializeLocation(result.location),
        });
        reply(ack, { ok: true });
      });
    });

    socket.on('error', (err: unknown) => {
      logger.warn({ err, userId: auth.userId }, 'Socket error');
    });
  });

  io.engine.on('connection_error', (err: unknown) => {
    logger.debug({ err }, 'Socket connection rejected');
  });

  return { io, forgetBooking: service.forget };
}
