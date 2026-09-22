import { z } from 'zod';

import { SUPPORTED_LANGUAGES } from './language.js';

/** Same shape the database enforces for category and city slugs, e.g. `ac-repair`. */
export const slugSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Must be a lowercase slug like "ac-repair".');

/** Optional `?lang=` query parameter. */
export const languageSchema = z.enum(SUPPORTED_LANGUAGES);
