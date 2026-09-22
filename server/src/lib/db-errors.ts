interface PgErrorShape {
  code?: string;
  constraint?: string;
}

/** Drizzle wraps driver errors, so the PostgreSQL error sits on `cause`. */
function pgErrorOf(error: unknown): PgErrorShape | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const source = 'cause' in error && typeof error.cause === 'object' ? error.cause : error;
  return (source as PgErrorShape | null) ?? undefined;
}

/**
 * Is this a unique-constraint violation (SQLSTATE 23505), optionally on one
 * specific constraint or index? Lets a service turn a lost race into a clean
 * 409 instead of a 500.
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = pgErrorOf(error);
  return pg?.code === '23505' && (constraint === undefined || pg.constraint === constraint);
}
