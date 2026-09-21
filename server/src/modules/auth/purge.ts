// CLI: `npm run auth:purge`. Deletes long-expired authentication rows.
import '../../config/dotenv.js';

import { loadDatabaseEnv } from '../../config/env.js';
import { createDatabase } from '../../db/client.js';
import { systemClock } from '../../lib/clock.js';
import { purgeExpiredAuthData } from './cleanup.service.js';

const config = loadDatabaseEnv();
const handle = createDatabase(config.databaseUrl);

try {
  const result = await purgeExpiredAuthData(handle.db, systemClock());
  console.log(
    `Purged ${String(result.otpChallenges)} OTP challenges, ` +
      `${String(result.refreshTokens)} refresh tokens, ${String(result.sessions)} sessions.`,
  );
} catch (error) {
  console.error('Purge failed:', error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
