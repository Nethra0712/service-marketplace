import { sql } from 'drizzle-orm';

import { createDatabase, type Database, type DatabaseHandle } from '../../src/db/client.js';

/**
 * The URL of the database tests are allowed to modify.
 *
 * Tests apply migrations and TRUNCATE tables, so this refuses anything whose
 * name does not end in `_test`, protecting the development database from an
 * accidental mix-up.
 */
export function getTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Add it to server/.env (see .env.example). ' +
        'It must point at a dedicated database whose name ends in "_test".',
    );
  }
  const databaseName = new URL(url).pathname.replace(/^\//, '');
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against database "${databaseName}": the name must end in "_test".`,
    );
  }
  return url;
}

export function createTestDatabase(): DatabaseHandle {
  return createDatabase(getTestDatabaseUrl());
}

/** Empties every application table so each test starts from a known state. */
export async function resetDatabase(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table refresh_tokens, auth_sessions, otp_challenges, provider_services, provider_profiles, profiles, users, service_categories restart identity cascade`,
  );
}

interface PgErrorShape {
  code?: string;
  constraint?: string;
}

/**
 * Runs `action`, expects it to fail with a PostgreSQL error, and returns that
 * error's SQLSTATE code and constraint name. Drizzle wraps driver errors, so
 * the original sits on `cause`.
 */
export async function expectPgError(
  action: () => Promise<unknown>,
): Promise<{ code: string | undefined; constraint: string | undefined }> {
  try {
    await action();
  } catch (error) {
    const pgError = (
      typeof error === 'object' && error !== null && 'cause' in error ? error.cause : error
    ) as PgErrorShape;
    return { code: pgError.code, constraint: pgError.constraint };
  }
  throw new Error('Expected the database to reject the statement, but it succeeded.');
}

/** SQLSTATE codes used in assertions. */
export const PgCode = {
  invalidEnumValue: '22P02',
  foreignKeyViolation: '23503',
  uniqueViolation: '23505',
  checkViolation: '23514',
} as const;
