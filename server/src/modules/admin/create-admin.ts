// CLI: `npm run admin:create -- <email> <password> <full name...>`
//
// The only way an admin account is ever created — there is deliberately no
// HTTP endpoint for it (see `admin-auth.routes.ts`'s doc comment), so this
// runs wherever the first admin actually needs to exist, production
// included, by someone who already has direct database/deploy access.
import '../../config/dotenv.js';

import { loadDatabaseEnv } from '../../config/env.js';
import { createDatabase } from '../../db/client.js';
import { adminUsers } from '../../db/schema/index.js';
import { isUniqueViolation } from '../../lib/db-errors.js';
import { hashPassword } from '../../lib/password.js';

const USAGE = 'Usage: npm run admin:create -- <email> <password> <full name...>';

const [email, password, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(' ').trim();
if (!email || !password || !fullName) {
  console.error(USAGE);
  process.exit(1);
}
if (password.length < 12) {
  console.error('Password must be at least 12 characters.');
  process.exit(1);
}

const config = loadDatabaseEnv();
const handle = createDatabase(config.databaseUrl);

try {
  const passwordHash = await hashPassword(password);
  const [row] = await handle.db
    .insert(adminUsers)
    .values({ email: email.trim().toLowerCase(), passwordHash, fullName })
    .returning({ id: adminUsers.id, email: adminUsers.email });
  console.log(`Admin created: ${row?.email} [${row?.id}]`);
} catch (error) {
  if (isUniqueViolation(error, 'admin_users_email_uidx')) {
    console.error(`An admin with email ${email} already exists.`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
} finally {
  await handle.close();
}
