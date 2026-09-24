import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Socket as ClientSocket } from 'socket.io-client';

import { buildTestApp, type TestApp } from '../helpers/app.js';
import { logout } from '../helpers/auth.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider } from '../helpers/factories.js';
import {
  connectClient,
  emitWithAck,
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
let customerRefreshToken: string;

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
  customerRefreshToken = signedIn.tokens.refreshToken;
});

afterEach(async () => {
  for (const socket of openSockets.splice(0)) socket.close();
  await realtime.close();
});
afterAll(() => handle.close());

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
  return { bookingId, providerToken: provider.tokens.accessToken };
}

describe('handshake authentication', () => {
  it('rejects a connection with no token', async () => {
    const socket = track(connectClient(realtime.url, undefined));
    const error = await waitForEvent<Error>(socket, 'connect_error');
    expect(error.message).toBe('UNAUTHENTICATED');
    expect(socket.connected).toBe(false);
  });

  it('rejects a connection with a malformed token', async () => {
    const socket = track(connectClient(realtime.url, 'not-a-real-token'));
    const error = await waitForEvent<Error>(socket, 'connect_error');
    expect(error.message).toBe('UNAUTHENTICATED');
  });

  it('accepts a connection with a valid access token', async () => {
    const socket = track(connectClient(realtime.url, customerToken));
    await waitForEvent(socket, 'connect');
    expect(socket.connected).toBe(true);
  });

  it('rejects a token whose session has been logged out, even though the JWT itself has not expired', async () => {
    await logout(t.app, customerRefreshToken);

    const socket = track(connectClient(realtime.url, customerToken));
    const error = await waitForEvent<Error>(socket, 'connect_error');
    expect(error.message).toBe('UNAUTHENTICATED');
  });
});

describe('booking rooms', () => {
  it('lets the customer join their own booking', async () => {
    const { bookingId } = await acceptedBooking();
    const socket = track(connectClient(realtime.url, customerToken));
    await waitForEvent(socket, 'connect');

    const ack = await emitWithAck<{ ok: boolean; role?: string }>(socket, 'booking:join', {
      bookingId,
    });

    expect(ack).toMatchObject({ ok: true, role: 'customer' });
  });

  it('lets the assigned provider join the same booking', async () => {
    const { bookingId, providerToken } = await acceptedBooking();
    const socket = track(connectClient(realtime.url, providerToken));
    await waitForEvent(socket, 'connect');

    const ack = await emitWithAck<{ ok: boolean; role?: string }>(socket, 'booking:join', {
      bookingId,
    });

    expect(ack).toMatchObject({ ok: true, role: 'provider' });
  });

  it('refuses an unrelated user, indistinguishably from a booking that does not exist', async () => {
    const { bookingId } = await acceptedBooking();
    const stranger = await signInUser(t.app, t.sms);
    const socket = track(connectClient(realtime.url, stranger.tokens.accessToken));
    await waitForEvent(socket, 'connect');

    const forReal = await emitWithAck<{ ok: boolean; error?: string }>(socket, 'booking:join', {
      bookingId,
    });
    const forFake = await emitWithAck<{ ok: boolean; error?: string }>(socket, 'booking:join', {
      bookingId: '00000000-0000-4000-8000-000000000000',
    });

    expect(forReal).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(forFake).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('rejects a malformed booking id', async () => {
    const socket = track(connectClient(realtime.url, customerToken));
    await waitForEvent(socket, 'connect');

    const ack = await emitWithAck<{ ok: boolean; error?: string }>(socket, 'booking:join', {
      bookingId: 'not-a-uuid',
    });

    expect(ack).toEqual({ ok: false, error: 'VALIDATION_ERROR' });
  });

  it('lets a joined party leave the room', async () => {
    const { bookingId } = await acceptedBooking();
    const socket = track(connectClient(realtime.url, customerToken));
    await waitForEvent(socket, 'connect');
    await emitWithAck(socket, 'booking:join', { bookingId });

    const ack = await emitWithAck<{ ok: boolean }>(socket, 'booking:leave', { bookingId });

    expect(ack).toEqual({ ok: true });
  });
});

describe('reconnection', () => {
  it('a client that reconnects re-authenticates and can rejoin its room', async () => {
    const { bookingId } = await acceptedBooking();
    const socket = track(connectClient(realtime.url, customerToken, { reconnection: true }));
    await waitForEvent(socket, 'connect');
    await emitWithAck(socket, 'booking:join', { bookingId });

    socket.disconnect();
    socket.connect();
    await waitForEvent(socket, 'connect');

    const ack = await emitWithAck<{ ok: boolean; role?: string }>(socket, 'booking:join', {
      bookingId,
    });
    expect(ack).toMatchObject({ ok: true, role: 'customer' });
  });
});
