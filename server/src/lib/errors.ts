/** Stable, machine-readable error codes returned to API clients. */
export const ErrorCode = {
  BadRequest: 'BAD_REQUEST',
  InvalidJson: 'INVALID_JSON',
  ValidationError: 'VALIDATION_ERROR',
  NotFound: 'NOT_FOUND',
  PayloadTooLarge: 'PAYLOAD_TOO_LARGE',
  UnsupportedMediaType: 'UNSUPPORTED_MEDIA_TYPE',
  DatabaseUnavailable: 'DATABASE_UNAVAILABLE',
  InternalError: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** One field-level problem, used for validation errors. */
export interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * An error whose message is safe to show to API clients.
 *
 * Anything that is NOT an AppError is treated as a bug and reported as a
 * generic 500. `cause` is logged server-side and never sent to clients.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    options?: { details?: ErrorDetail[]; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.details = options?.details;
  }

  readonly details: ErrorDetail[] | undefined;
}

/** The JSON body of every error response. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
    details?: ErrorDetail[];
  };
}
