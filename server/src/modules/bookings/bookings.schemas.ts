import { z } from 'zod';

import { bookingStatus, bookingType } from '../../db/schema/index.js';
import { languageSchema, slugSchema } from '../../lib/schemas.js';

const langQuery = z.object({ lang: languageSchema.optional() });
const idParams = z.object({ id: z.uuid() });
const quoteIdParams = z.object({ id: z.uuid(), quoteId: z.uuid() });

/** Two decimal places, positive, and small enough to rule out fat-finger errors. */
const money = z
  .number()
  .positive('Enter an amount greater than zero.')
  .max(10_000_000, 'That amount looks too large.')
  .refine(
    (value) => Math.round(value * 100) === value * 100,
    'Amounts can have at most two decimal places.',
  );

const bookingIdParamsWithLang = z.object({ params: idParams, query: langQuery });

export const bookingsSchemas = {
  create: z.object({
    query: langQuery,
    body: z
      .strictObject({
        categorySlug: slugSchema,
        citySlug: slugSchema,
        bookingType: z.enum(bookingType.enumValues),
        // Required for `scheduled`, forbidden for `on_demand`; checked below.
        scheduledAt: z.iso.datetime({ offset: true }).optional(),
        serviceAddress: z.string().trim().min(1, 'Enter the service address.').max(500),
        customerNotes: z.string().trim().max(1000).nullish(),
      })
      .refine((v) => v.bookingType !== 'scheduled' || v.scheduledAt !== undefined, {
        message: 'Choose when you want the service.',
        path: ['scheduledAt'],
      })
      .refine((v) => v.bookingType !== 'on_demand' || v.scheduledAt === undefined, {
        message: 'An on-demand request cannot have a scheduled time.',
        path: ['scheduledAt'],
      }),
  }),

  list: z.object({
    query: langQuery.extend({ status: z.enum(bookingStatus.enumValues).optional() }),
  }),

  get: bookingIdParamsWithLang,

  cancel: z.object({
    params: idParams,
    query: langQuery,
    body: z.strictObject({
      reason: z.string().trim().min(1, 'Enter a reason for cancelling.').max(500),
    }),
  }),

  release: z.object({
    params: idParams,
    query: langQuery,
    body: z.strictObject({
      reason: z.string().trim().min(1, 'Enter a reason for releasing this booking.').max(500),
    }),
  }),

  /** No body: en-route, arrived, start, complete, accept are all plain actions. */
  action: bookingIdParamsWithLang,

  submitQuote: z.object({
    params: idParams,
    query: langQuery,
    body: z.strictObject({
      amount: money,
      note: z.string().trim().max(500).nullish(),
    }),
  }),

  quoteDecision: z.object({ params: quoteIdParams, query: langQuery }),
};
