// CLI: `npm run db:migrate`. Applies pending migrations to DATABASE_URL.
import '../config/dotenv.js';

import { loadEnv } from '../config/env.js';
import { createDatabase } from './client.js';
import { runMigrations } from './migrator.js';

const config = loadEnv();
const handle = createDatabase(config.databaseUrl);

try {
  await runMigrations(handle.db);
  console.log('Migrations applied.');
} catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
