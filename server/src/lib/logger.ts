import { pino, type DestinationStream, type Logger } from 'pino';

import type { AppConfig } from '../config/env.js';

export type { Logger };

/** Structured JSON logger. Credentials in headers are redacted. */
export function createLogger(
  config: Pick<AppConfig, 'logLevel'>,
  /** Where to write. Defaults to stdout; tests pass a stream to inspect the output. */
  destination?: DestinationStream,
): Logger {
  return pino(
    {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          // Belt and braces: request bodies are not logged, but if one ever is,
          // credentials must not appear in it.
          '*.accessToken',
          '*.refreshToken',
        ],
        censor: '[redacted]',
      },
    },
    destination,
  );
}
