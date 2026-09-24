import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Socket as ClientSocket } from 'socket.io-client';

import { MIN_UPDATE_INTERVAL_MS } from '../../src/modules/realtime/index.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider } from '../helpers/factories.js';
import {
  connectClient,
  emitWithAck,
  expectNoEvent,
  startRealtimeTestServer,
  waitForEvent,
  type RealtimeTestServer,
} from '../helpers/realtime.js';
import { signInUser, type Api } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;

let t: TestApp;
let realtime: RealtimeTestServer;
let catalogue: Catalogue;
let customer: Api;
let customerToken: string;

const openSockets: ClientSocket[] = [];
function track(socket: ClientSocket): ClientSocket {
  openSockets.push(socket);
  return socket;
}

beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
  realtime = await startRealtimeTestServer(t);
  const signedIn = await signInUser(t.app, t.sms);
  customer = signedIn.api;
  customerToken = signedIn.tokens.accessToken;
});

afterEach(async () => {
  for (const socket of openSockets.splice(0)) socket.close();
  await realtime.close();
});
afterAll(() => handle.close());

const VALID_POINT = { latitude: 6.9271, longitude: 79.8612 };

async function acceptedBooking() {
  const { user } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);
  const provider = await signInUser(t.app, t.sms, user.phoneE164);
  const created = await customer.post('/api/bookings', {
    categorySlug: 'cleaning',
    citySlug: 'colombo',
    bookingType: 'on_demand',
    serviceAddress: '12 Galle Road',
  });
  const bookingId = (created.body as { id: string }).id;
  const accepted = await provider.api.post(`/api/bookings/${bookingId}/accept`);
  expect(accepted.status).toBe(200);
  return { bookingId, providerToken: provider.tokens.accessToken, providerApi: provider.api };
}

/** Both sockets connected and joined to `bookingId`'s room. */
async function connectedPair(bookingId: string, customerTok: string, providerTok: string) {
  const customerSocket = track(connectClient(realtime.url, customerTok));
  const providerSocket = track(connectClient(realtime.url, providerTok));
  await Promise.all([
    waitForEvent(customerSocket, 'connect'),
    waitForEvent(providerSocket, 'connect'),
  ]);
  await Promise.all([
    emitWithAck(customerSocket, 'booking:join', { bookingId }),
    emitWithAck(providerSocket, 'booking:join', { bookingId }),
  ]);
  return { customerSocket, providerSocket };
}

describe('location updates', () => {
  it('broadcasts a valid update from the assigned provider to the room, but not back to the sender', async () => {
    const { bookingId, providerToken } = await acceptedBooking();
    const { customerSocket, providerSocket } = await connectedPair(
      bookingId,
      customerToken,
      providerToken,
    );

    const [ack, received] = await Promise.all([
      emitWithAck<{ ok: boolean }>(providerSocket, 'location:update', {
        bookingId,
        ...VALID_POINT,
      }),
      waitForEvent<{ bookingId: string; latitude: number; longitude: number }>(
        customerSocket,
        'location:update',
      ),
      expectNoEvent(providerSocket, 'location:update'),
    ]);

    expect(ack).toEqual({ ok: true });
    expect(received).toMatchObject({ bookingId, ...VALID_POINT });
  });

  it("hands a joining customer the provider's last known location, if any", async () => {
    const { bookingId, providerToken } = await acceptedBooking();
    const providerSocket = track(connectClient(realtime.url, providerToken));
    await waitForEvent(providerSocket, 'connect');
    await emitWithAck(providerSocket, 'booking:join', { bookingId });
    await emitWithAck(providerSocket, 'location:update', { bookingId, ...VALID_POINT });

    const customerSocket = track(connectClient(realtime.url, customerToken));
    await waitForEvent(customerSocket, 'connect');
    const ack = await emitWithAck<{ ok: boolean; lastLocation: { latitude: number } | null }>(
      customerSocket,
      'booking:join',
      { bookingId },
    );

    expect(ack.lastLocation).toMatchObject({ latitude: VALID_POINT.latitude });
  });

  it('rejects invalid coordinates', async () => {
    const { bookingId, providerToken } = await acceptedBooking();
    const providerSocket = track(connectClient(realtime.url, providerToken));
    await waitForEvent(providerSocket, 'connect');
    await emitWithAck(providerSocket, 'booking:join', { bookingId });

    const tooFarNorth = await emitWithAck<{ ok: boolean; error?: string }>(
      providerSocket,
      'location:update',
      { bookingId, latitude: 200, longitude: 0 },
    );
    const tooFarEast = await emitWithAck<{ ok: boolean; error?: string }>(
      providerSocket,
      'location:update',
      { bookingId, latitude: 0, longitude: -181 },
    );
    const missingField = await emitWithAck<{ ok: boolean; error?: string }>(
      providerSocket,
      'location:update',
      { bookingId, latitude: 0 },
    );

    expect(tooFarNorth).toEqual({ ok: false, error: 'VALIDATION_ERROR' });
    expect(tooFarEast).toEqual({ ok: false, error: 'VALIDATION_ERROR' });
    expect(missingField).toEqual({ ok: false, error: 'VALIDATION_ERROR' });
  });

  it('refuses an update from the customer (not the provider)', async () => {
    const { bookingId } = await acceptedBooking();
    const customerSocket = track(connectClient(realtime.url, customerToken));
    await waitForEvent(customerSocket, 'connect');
    await emitWithAck(customerSocket, 'booking:join', { bookingId });

    const ack = await emitWithAck<{ ok: boolean; error?: string }>(
      customerSocket,
      'location:update',
      {
        bookingId,
        ...VALID_POINT,
      },
    );

    expect(ack).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('refuses an update from a provider who is not assigned to this booking', async () => {
    const { bookingId } = await acceptedBooking();
    const { user: otherUser } = await createApprovedProvider(
      db,
      catalogue.cleaning,
      catalogue.colombo,
    );
    const outsider = await signInUser(t.app, t.sms, otherUser.phoneE164);
    const socket = track(connectClient(realtime.url, outsider.tokens.accessToken));
    await waitForEvent(socket, 'connect');

    const ack = await emitWithAck<{ ok: boolean; error?: string }>(socket, 'location:update', {
      bookingId,
      ...VALID_POINT,
    });

    expect(ack).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('refuses an update for a booking that does not exist', async () => {
    const { providerToken } = await acceptedBooking();
    const socket = track(connectClient(realtime.url, providerToken));
    await waitForEvent(socket, 'connect');

    const ack = await emitWithAck<{ ok: boolean; error?: string }>(socket, 'location:update', {
      bookingId: '00000000-0000-4000-8000-000000000000',
      ...VALID_POINT,
    });

    expect(ack).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('stops accepting updates once the booking is completed', async () => {
    const { bookingId, providerToken, providerApi } = await acceptedBooking();
    const socket = track(connectClient(realtime.url, providerToken));
    await waitForEvent(socket, 'connect');
    await emitWithAck(socket, 'booking:join', { bookingId });

    const whileTrackable = await emitWithAck<{ ok: boolean }>(socket, 'location:update', {
      bookingId,
      ...VALID_POINT,
    });
    expect(whileTrackable).toEqual({ ok: true });

    expect((await providerApi.post(`/api/bookings/${bookingId}/en-route`)).status).toBe(200);
    expect((await providerApi.post(`/api/bookings/${bookingId}/arrived`)).status).toBe(200);
    expect((await providerApi.post(`/api/bookings/${bookingId}/start`)).status).toBe(200);
    // `cleaning` is hourly-priced: its price is only settled at completion,
    // from the time actually worked, so some time must pass first (kept well
    // under the access token's TTL so the request itself still authenticates).
    t.clock.advanceSeconds(60);
    expect((await providerApi.post(`/api/bookings/${bookingId}/complete`)).status).toBe(200);

    const afterCompletion = await emitWithAck<{ ok: boolean; error?: string }>(
      socket,
      'location:update',
      { bookingId, ...VALID_POINT },
    );
    expect(afterCompletion).toEqual({ ok: false, error: 'NOT_TRACKABLE' });
  });

  it('stops accepting updates once the provider releases the job', async () => {
    const { bookingId, providerToken, providerApi } = await acceptedBooking();
    const socket = track(connectClient(realtime.url, providerToken));
    await waitForEvent(socket, 'connect');
    await emitWithAck(socket, 'booking:join', { bookingId });

    const release = await providerApi.post(`/api/bookings/${bookingId}/release`, {
      reason: 'Vehicle broke down.',
    });
    expect(release.status).toBe(200);

    const ack = await emitWithAck<{ ok: boolean; error?: string }>(socket, 'location:update', {
      bookingId,
      ...VALID_POINT,
    });
    // The booking is searching again and this provider is no longer assigned to it.
    expect(ack).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('rate limiting', () => {
  it('drops an update that arrives before the minimum interval has passed', async () => {
    const { bookingId, providerToken } = await acceptedBooking();
    const { providerSocket } = await connectedPair(bookingId, customerToken, providerToken);

    const first = await emitWithAck<{ ok: boolean }>(providerSocket, 'location:update', {
      bookingId,
      ...VALID_POINT,
    });
    const second = await emitWithAck<{ ok: boolean; error?: string }>(
      providerSocket,
      'location:update',
      {
        bookingId,
        latitude: VALID_POINT.latitude + 0.001,
        longitude: VALID_POINT.longitude,
      },
    );

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: false, error: 'RATE_LIMITED' });
  });

  it('accepts a new update once the minimum interval has passed', async () => {
    const { bookingId, providerToken } = await acceptedBooking();
    const { providerSocket } = await connectedPair(bookingId, customerToken, providerToken);

    await emitWithAck(providerSocket, 'location:update', { bookingId, ...VALID_POINT });
    t.clock.advanceSeconds(MIN_UPDATE_INTERVAL_MS / 1000 + 1);
    const ack = await emitWithAck<{ ok: boolean }>(providerSocket, 'location:update', {
      bookingId,
      latitude: VALID_POINT.latitude + 0.001,
      longitude: VALID_POINT.longitude,
    });

    expect(ack).toEqual({ ok: true });
  });
});

describe("authorization: only room members receive a booking's location", () => {
  it('a stranger never receives location updates for a booking they cannot join', async () => {
    const { bookingId, providerToken } = await acceptedBooking();
    const stranger = await signInUser(t.app, t.sms);
    const strangerSocket = track(connectClient(realtime.url, stranger.tokens.accessToken));
    const providerSocket = track(connectClient(realtime.url, providerToken));
    await Promise.all([
      waitForEvent(strangerSocket, 'connect'),
      waitForEvent(providerSocket, 'connect'),
    ]);
    await emitWithAck(providerSocket, 'booking:join', { bookingId });
    // The stranger never successfully joins (see connection.test.ts), but might still be
    // listening on the raw socket if a room name were guessable; confirm they hear nothing.

    await Promise.all([
      emitWithAck(providerSocket, 'location:update', { bookingId, ...VALID_POINT }),
      expectNoEvent(strangerSocket, 'location:update'),
    ]);
  });
});
