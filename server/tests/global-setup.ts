import { config } from 'dotenv';

import { runMigrations } from '../src/db/migrator.js';
import { createTestDatabase } from './helpers/database.js';

config({ quiet: true });

/** Runs once before all tests: brings the test database to the latest schema. */
export default async function setup(): Promise<void> {
  const handle = createTestDatabase();
  try {
    await runMigrations(handle.db);
  } finally {
    await handle.close();
  }
}
