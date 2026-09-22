import { z } from 'zod';

import { pricingModel } from '../../db/schema/index.js';
import { languageSchema, slugSchema } from '../../lib/schemas.js';

export const catalogueSchemas = {
  cities: z.object({ query: z.object({}) }),
  categories: z.object({
    query: z.object({
      // Whitespace-only and empty searches mean "no search".
      q: z
        .string()
        .trim()
        .max(100)
        .optional()
        .transform((value) => (value === undefined || value === '' ? undefined : value)),
      pricingModel: z.enum(pricingModel.enumValues).optional(),
      city: slugSchema.optional(),
      lang: languageSchema.optional(),
    }),
  }),
  category: z.object({
    params: z.object({ slug: slugSchema }),
    query: z.object({ city: slugSchema.optional(), lang: languageSchema.optional() }),
  }),
};
