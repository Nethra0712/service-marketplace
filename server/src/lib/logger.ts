import { pino, type Logger } from 'pino';

import type { AppConfig } from '../config/env.js';

export type { Logger };

/** Structured JSON logger. Credentials in headers are redacted. */
export function createLogger(config: Pick<AppConfig, 'logLevel'>): Logger {
  return pino({
    level: config.logLevel,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
  });
}
