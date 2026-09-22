import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';

import { withTimeout } from '../lib/timeout.js';
import type { Logger } from '../lib/logger.js';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

/**
 * Anything queries can run on: the database itself or a transaction. Repositories
 * accept this, so a service can decide whether several calls share a transaction.
 */
export type Queryable = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/** The transaction handle passed to `db.transaction(async (tx) => ...)`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DatabaseHandle {
  db: Database;
  pool: pg.Pool;
  /** Resolves if PostgreSQL answers a trivial query, rejects otherwise. */
  ping: () => Promise<void>;
  /** Drains the pool. Call once during shutdown. */
  close: () => Promise<void>;
}

const PING_TIMEOUT_MS = 3_000;

export function createDatabase(
  databaseUrl: string,
  options: { logger?: Logger; maxConnections?: number } = {},
): DatabaseHandle {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: options.maxConnections ?? 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

  // Without a listener, an error on an idle connection (e.g. the database
  // restarting) would crash the process as an unhandled 'error' event.
  pool.on('error', (err) => {
    options.logger?.error({ err }, 'Unexpected error on idle database connection');
  });

  const db = drizzle(pool, { schema, casing: 'snake_case' });

  return {
    db,
    pool,
    ping: async () => {
      await withTimeout(pool.query('select 1'), PING_TIMEOUT_MS, 'Database ping');
    },
    close: () => pool.end(),
  };
}
