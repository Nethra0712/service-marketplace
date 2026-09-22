import { z } from 'zod';

import { languageSchema, slugSchema } from '../../lib/schemas.js';

const langQuery = z.object({ lang: languageSchema.optional() });
const idParams = z.object({ id: z.uuid() });

export const providersSchemas = {
  getProfile: z.object({}),

  /**
   * Strict on purpose: a client that sends `verificationStatus`, `userId` or
   * anything else is rejected, so provider-controlled fields can never be
   * widened by accident (mass assignment).
   */
  saveProfile: z.object({
    body: z.strictObject({
      fullName: z.string().trim().min(1, 'Enter your full name.').max(100),
      bio: z.string().trim().max(1000).nullish(),
      yearsOfExperience: z.number().int().min(0).max(60).nullish(),
    }),
  }),

  submitProfile: z.object({}),

  listApplications: z.object({ query: langQuery }),

  apply: z.object({
    query: langQuery,
    body: z.strictObject({ categorySlug: slugSchema, citySlug: slugSchema }),
  }),

  application: z.object({ params: idParams, query: langQuery }),
};
