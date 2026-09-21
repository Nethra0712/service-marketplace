import type { AppConfig } from '../../config/env.js';

/** Development seed data must never reach a production database. */
export function assertSeedAllowed(nodeEnv: AppConfig['nodeEnv']): void {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to run the development seed with NODE_ENV=production.');
  }
}
