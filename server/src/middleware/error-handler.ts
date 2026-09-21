import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError, ErrorCode, type ApiErrorBody } from '../lib/errors.js';

interface HttpLikeError {
  status: number;
  type?: unknown;
}

/** Errors raised by Express/body-parser carry an HTTP status (e.g. 413, 400). */
function isClientHttpError(err: unknown): err is HttpLikeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  );
}

/**
 * Translates any thrown value into an AppError with a client-safe message.
 * Raw error messages are never forwarded: parser and driver messages can echo
 * request content or reveal internals.
 */
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(400, ErrorCode.ValidationError, 'Request validation failed.', {
      details: err.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    });
  }

  if (isClientHttpError(err)) {
    if (err.status === 413) {
      return new AppError(413, ErrorCode.PayloadTooLarge, 'Request body is too large.');
    }
    if (err.status === 415) {
      return new AppError(415, ErrorCode.UnsupportedMediaType, 'Unsupported content type.');
    }
    if (err.type === 'entity.parse.failed') {
      return new AppError(400, ErrorCode.InvalidJson, 'Request body is not valid JSON.');
    }
    return new AppError(err.status, ErrorCode.BadRequest, 'The request could not be processed.');
  }

  return new AppError(500, ErrorCode.InternalError, 'An unexpected error occurred.', {
    cause: err,
  });
}

/**
 * Central error handler, registered last. Every error response has the shape
 * `{ error: { code, message, requestId, details? } }`.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const appError = toAppError(err);

  if (appError.status >= 500) {
    // Log the real cause server-side; the client only sees the safe message.
    req.log.error({ err: appError.cause ?? appError }, appError.message);
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...((typeof req.id === 'string' || typeof req.id === 'number') && {
        requestId: String(req.id),
      }),
      ...(appError.details && { details: appError.details }),
    },
  };

  if (appError.headers) res.set(appError.headers);
  res.status(appError.status).json(body);
};
