import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import type { AppConfig } from './config/env.js';
import type { Logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createHealthRouter } from './modules/health/health.routes.js';

/** Largest JSON request body accepted. Raise per-route later if a feature needs it. */
const JSON_BODY_LIMIT = '100kb';

/** Only echo a caller-supplied request id if it is short and harmless. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export interface AppDependencies {
  config: Pick<AppConfig, 'corsOrigins'>;
  logger: Logger;
  pingDatabase: () => Promise<void>;
}

/**
 * Builds the Express app. It takes its dependencies as arguments, with no
 * globals or side effects, so tests can create as many isolated instances as
 * they need.
 */
export function createApp({ config, logger, pingDatabase }: AppDependencies): Express {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Health probes run constantly; logging each would drown real traffic.
      autoLogging: { ignore: (req) => req.url.startsWith('/api/health') },
    }),
  );
  app.use(helmet()); // also removes the X-Powered-By header
  app.use(cors({ origin: config.corsOrigins.length > 0 ? config.corsOrigins : false }));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use('/api/health', createHealthRouter({ pingDatabase }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
