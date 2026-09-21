// Side-effect module: loads `.env` into process.env for local development.
// Import it first in every entry point. In deployed environments there is no
// `.env` file and variables come from the platform, so this is a no-op there.
import { config } from 'dotenv';

config({ quiet: true });
