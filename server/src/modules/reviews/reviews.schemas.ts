import { z } from 'zod';

const bookingParams = z.object({ id: z.uuid() });

export const reviewsSchemas = {
  submit: z.object({
    params: bookingParams,
    body: z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).optional(),
    }),
  }),
  forBooking: z.object({ params: bookingParams }),
  providerSummary: z.object({ params: z.object({ providerProfileId: z.uuid() }) }),
};
