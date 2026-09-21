import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { Database } from './client.js';

/**
 * Migration SQL sits next to this file: `src/db/migrations` in development and
 * `dist/db/migrations` after `npm run build` (which copies it).
 */
export const migrationsFolder = path.resolve(import.meta.dirname, 'migrations');

/** Applies all pending migrations. Safe to run repeatedly. */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder });
}
