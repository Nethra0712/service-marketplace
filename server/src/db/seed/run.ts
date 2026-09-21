// CLI: `npm run db:seed`. Loads DEVELOPMENT example data only.
import '../../config/dotenv.js';

import { loadDatabaseEnv } from '../../config/env.js';
import { createDatabase } from '../client.js';
import { assertSeedAllowed } from './guard.js';
import { seedServiceCategories } from './service-categories.js';

const config = loadDatabaseEnv();
assertSeedAllowed(config.nodeEnv);

const handle = createDatabase(config.databaseUrl);

try {
  const inserted = await seedServiceCategories(handle.db);
  console.log(`Seeded service categories: ${inserted} inserted, the rest already existed.`);
} catch (error) {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
