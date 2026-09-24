import { z } from 'zod';

const MAX_TOKEN_LENGTH = 4096;

const tokenBody = z.object({
  token: z.string().trim().min(1).max(MAX_TOKEN_LENGTH),
  platform: z.enum(['android', 'ios']),
});

export const notificationsSchemas = {
  registerToken: z.object({ body: tokenBody }),
  removeToken: z.object({
    body: z.object({ token: z.string().trim().min(1).max(MAX_TOKEN_LENGTH) }),
  }),
  setPreferences: z.object({ body: z.object({ pushEnabled: z.boolean() }) }),
  list: z.object({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      before: z.iso.datetime({ offset: true }).optional(),
    }),
  }),
  markRead: z.object({ params: z.object({ id: z.uuid() }) }),
};
