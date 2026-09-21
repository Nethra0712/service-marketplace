import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ quiet: true });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  // TypeScript uses camelCase, the database uses snake_case.
  casing: 'snake_case',
  strict: true,
  verbose: true,
  // `generate` needs no connection. Migrations are applied by src/db/migrate.ts.
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
