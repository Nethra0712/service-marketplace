import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

import { createLogger } from '../../src/lib/logger.js';
import { createRealtimeModule, type RealtimeModule } from '../../src/modules/realtime/index.js';
import type { TestApp } from './app.js';

export interface RealtimeTestServer {
  realtimeModule: RealtimeModule;
  url: string;
  close: () => Promise<void>;
}

/** Wraps a `TestApp`'s Express app in a real, listening HTTP server with the realtime module attached. */
export async function startRealtimeTestServer(testApp: TestApp): Promise<RealtimeTestServer> {
  const httpServer = http.createServer(testApp.app);
  const realtimeModule = createRealtimeModule({
    httpServer,
    authenticate: testApp.realtime.authenticate,
    findBookingAccess: testApp.realtime.findBookingAccess,
    findProviderProfileId: testApp.realtime.findProviderProfileId,
    clock: testApp.clock.now,
    logger: createLogger({ logLevel: 'silent' }),
    corsOrigins: [],
  });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  return {
    realtimeModule,
    url: `http://127.0.0.1:${port}`,
    close: () => realtimeModule.io.close(),
  };
}

/** A socket.io-client connection. `reconnection` is off by default: tests that need it turn it on explicitly. */
export function connectClient(
  url: string,
  token: string | undefined,
  options: { reconnection?: boolean } = {},
): ClientSocket {
  return ioClient(url, {
    auth: token === undefined ? {} : { token },
    transports: ['websocket'],
    reconnection: options.reconnection ?? false,
    reconnectionDelay: 20,
    reconnectionDelayMax: 50,
    forceNew: true,
  });
}

export function waitForEvent<T = unknown>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export function emitWithAck<T = unknown>(
  socket: ClientSocket,
  event: string,
  payload: unknown,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ack on "${event}"`));
    }, timeoutMs);
    socket.emit(event, payload, (ack: T) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

/** Rejects if `event` fires within `timeoutMs`; resolves (proving silence) otherwise. */
export function expectNoEvent(socket: ClientSocket, event: string, timeoutMs = 300): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => {
      reject(new Error(`Expected no "${event}" event, but one arrived.`));
    };
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, timeoutMs);
  });
}
