// Copies the SQL migrations next to the compiled output, since `tsc` only
// emits JavaScript. Run by `npm run build`.
import { cpSync } from 'node:fs';

cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true });
console.log('Copied migrations to dist/db/migrations');
