import type { ApiErrorBody } from '../../src/lib/errors.js';

/** supertest types response bodies as `any`; this gives error bodies their real type. */
export function errorOf(res: { body: unknown }): ApiErrorBody['error'] {
  return (res.body as ApiErrorBody).error;
}
