import type { RequestHandler } from 'express';

import { AppError, ErrorCode } from '../lib/errors.js';

/** Fallback for any request no route handled. Passes a 404 to the error handler. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, ErrorCode.NotFound, 'Resource not found.'));
};
