import { z } from 'zod';

/** Validated, typed application configuration. */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  /** Browser origins allowed by CORS. Empty means no cross-origin access. */
  corsOrigins: string[];
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

const isPostgresUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'postgres:' || protocol === 'postgresql:';
  } catch {
    return false;
  }
};

const corsOriginsSchema = z
  .string()
  .default('')
  .transform((value, ctx) => {
    const origins = value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    for (const origin of origins) {
      let normalized: string | undefined;
      try {
        normalized = new URL(origin).origin;
      } catch {
        normalized = undefined;
      }
      if (normalized !== origin) {
        ctx.issues.push({
          code: 'custom',
          message: 'must be a comma-separated list of origins like https://admin.example.com',
          input: value,
        });
        return z.NEVER;
      }
    }
    return origins;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string({ error: 'is required' })
    .refine(isPostgresUrl, { error: 'must be a postgres:// or postgresql:// URL' }),
  CORS_ORIGINS: corsOriginsSchema,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

/** Thrown when the environment is invalid. The message never contains values. */
export class EnvValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Parses and validates environment variables.
 *
 * Only variable names and rule descriptions are reported on failure, never the
 * values, because DATABASE_URL contains credentials.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
    );
  }
  const env = result.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    corsOrigins: env.CORS_ORIGINS,
    logLevel: env.LOG_LEVEL,
  };
}
