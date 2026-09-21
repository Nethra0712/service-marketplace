import type { Request } from 'express';
import type { z } from 'zod';

/**
 * Validates the parts of a request described by `schema`.
 *
 * ```ts
 * const schema = z.object({ body: z.object({ name: z.string() }) });
 * const { body } = parseRequest(schema, req);
 * ```
 *
 * Throws a ZodError on failure, which the central error handler turns into a
 * 400 VALIDATION_ERROR response. Returning the parsed value (instead of
 * mutating `req`) keeps handlers fully typed.
 */
export function parseRequest<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  const input: unknown = { body: req.body as unknown, query: req.query, params: req.params };
  return schema.parse(input);
}
