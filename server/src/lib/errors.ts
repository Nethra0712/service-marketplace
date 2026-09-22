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
  // Authentication
  Unauthenticated: 'UNAUTHENTICATED',
  AccountSuspended: 'ACCOUNT_SUSPENDED',
  InvalidOtp: 'INVALID_OTP',
  OtpAttemptsExceeded: 'OTP_ATTEMPTS_EXCEEDED',
  OtpResendCooldown: 'OTP_RESEND_COOLDOWN',
  InvalidRefreshToken: 'INVALID_REFRESH_TOKEN',
  RateLimited: 'RATE_LIMITED',
  SmsUnavailable: 'SMS_UNAVAILABLE',
  // Providers
  ProviderProfileNotFound: 'PROVIDER_PROFILE_NOT_FOUND',
  ProviderProfileRequired: 'PROVIDER_PROFILE_REQUIRED',
  ProfileIncomplete: 'PROFILE_INCOMPLETE',
  AlreadyApplied: 'ALREADY_APPLIED',
  InvalidState: 'INVALID_STATE',
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
 * `headers` are sent with the response (for example `Retry-After`).
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    options?: { details?: ErrorDetail[]; cause?: unknown; headers?: Record<string, string> },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.details = options?.details;
    this.headers = options?.headers;
  }

  readonly details: ErrorDetail[] | undefined;
  readonly headers: Record<string, string> | undefined;
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
