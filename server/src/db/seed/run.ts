// CLI: `npm run db:seed`. Loads DEVELOPMENT example data only.
import '../../config/dotenv.js';

import { loadDatabaseEnv } from '../../config/env.js';
import { createDatabase } from '../client.js';
import { assertSeedAllowed } from './guard.js';
import { seedCatalogue } from './service-categories.js';

const config = loadDatabaseEnv();
assertSeedAllowed(config.nodeEnv);

const handle = createDatabase(config.databaseUrl);

try {
  const result = await seedCatalogue(handle.db);
  console.log(
    `Seeded catalogue: ${String(result.categories)} categories, ${String(result.translations)} translations, ` +
      `${String(result.cityLinks)} city links added (existing rows are left as they were).`,
  );
} catch (error) {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
