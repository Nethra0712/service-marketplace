import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import { AppError, ErrorCode } from '../lib/errors.js';

export interface RateLimitPolicy {
  windowMs: number;
  /** Maximum requests per client IP within the window. */
  limit: number;
}

/**
 * Per-client-IP request limiter answering with the standard error body.
 *
 * Counters live in this process's memory. That is enough for a single API
 * instance; behind several instances (or across restarts) the limits become
 * approximate until a shared store (Redis) replaces it.
 */
export function createIpRateLimiter({ windowMs, limit }: RateLimitPolicy): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res, next) => {
      const retryAfter = res.getHeader('Retry-After');
      next(
        new AppError(429, ErrorCode.RateLimited, 'Too many requests. Please try again later.', {
          headers: retryAfter === undefined ? undefined : { 'Retry-After': String(retryAfter) },
        }),
      );
    },
  });
}
