import { config } from 'dotenv';

// Runs before each test file.
config({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Point anything that reads DATABASE_URL at the test database, never at the
// development one.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}
