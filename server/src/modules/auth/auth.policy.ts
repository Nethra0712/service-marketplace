export interface RateLimitPolicy {
  windowMs: number;
  /** Maximum requests per client IP within the window. */
  limit: number;
}

/**
 * Every security-relevant number in one place. These are defaults chosen for
 * safety, not business requirements, and can be tuned without touching logic.
 * Tests override them through `createApp`.
 */
export interface AuthPolicy {
  otpLength: number;
  otpTtlSeconds: number;
  /** Guesses allowed per code before it is locked. */
  otpMaxAttempts: number;
  /** Minimum gap between two code requests for the same phone. */
  otpResendCooldownSeconds: number;
  /** Code requests allowed per phone in any rolling hour. */
  otpMaxRequestsPerPhonePerHour: number;
  accessTokenTtlSeconds: number;
  /** Lifetime of one refresh token. Every refresh issues a fresh one (sliding). */
  refreshTokenTtlSeconds: number;
  /** Hard limit on a session's total life, however often it is refreshed. */
  sessionMaxAgeSeconds: number;
  /**
   * Per-IP limits. Kept generous because mobile carriers put many customers
   * behind one address (CGNAT); the per-phone rules above are the strict ones.
   */
  rateLimits: {
    otpRequest: RateLimitPolicy;
    otpVerify: RateLimitPolicy;
    refresh: RateLimitPolicy;
  };
}

const MINUTE_MS = 60_000;
const DAY_SECONDS = 24 * 60 * 60;

export const defaultAuthPolicy: AuthPolicy = {
  otpLength: 6,
  otpTtlSeconds: 5 * 60,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  otpMaxRequestsPerPhonePerHour: 5,
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 30 * DAY_SECONDS,
  sessionMaxAgeSeconds: 90 * DAY_SECONDS,
  rateLimits: {
    otpRequest: { windowMs: 15 * MINUTE_MS, limit: 20 },
    otpVerify: { windowMs: 15 * MINUTE_MS, limit: 60 },
    refresh: { windowMs: 15 * MINUTE_MS, limit: 120 },
  },
};
