import { z } from 'zod';

export const adminAuthSchemas = {
  login: z.object({
    body: z.object({
      email: z.email(),
      password: z.string().min(1).max(200),
    }),
  }),
};
