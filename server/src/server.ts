import './config/dotenv.js';

import http from 'node:http';

import { createApp } from './app.js';
import { EnvValidationError, loadEnv, type AppConfig } from './config/env.js';
import { createDatabase } from './db/client.js';
import { systemClock } from './lib/clock.js';
import { createLogger } from './lib/logger.js';
import { createRealtimeModule } from './modules/realtime/index.js';
import { createSmsProvider } from './modules/sms/index.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let config: AppConfig;
try {
  config = loadEnv();
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const logger = createLogger(config);
const database = createDatabase(config.databaseUrl, { logger });
const { app, realtime: realtimeDeps } = createApp({
  config,
  logger,
  db: database.db,
  pingDatabase: database.ping,
  sms: createSmsProvider(config, logger),
  clock: systemClock,
});

// Socket.IO attaches to the raw HTTP server, not to Express itself, so the
// server is created explicitly here instead of via `app.listen(...)`.
const server = http.createServer(app);
createRealtimeModule({
  httpServer: server,
  authenticate: realtimeDeps.authenticate,
  findBookingAccess: realtimeDeps.findBookingAccess,
  findProviderProfileId: realtimeDeps.findProviderProfileId,
  clock: systemClock,
  logger,
  corsOrigins: config.corsOrigins,
});

server.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'API server listening');

  // Report database reachability at startup without blocking or crashing:
  // the server stays up and /api/health/db keeps reporting the live status.
  database.ping().then(
    () => {
      logger.info('Database connection OK');
    },
    (err: unknown) => {
      logger.error({ err }, 'Database connection FAILED at startup');
    },
  );
});

server.on('error', (err) => {
  logger.fatal({ err }, 'HTTP server error');
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  // Stop accepting connections, let in-flight requests finish, then drain the pool.
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  await database.close();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
