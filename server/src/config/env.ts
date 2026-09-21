import { z } from 'zod';

/** Validated, typed application configuration. */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  /** Browser origins allowed by CORS. Empty means no cross-origin access. */
  corsOrigins: string[];
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  /** Signs access tokens (HS256). At least 32 characters. */
  jwtAccessSecret: string;
  /** Keys the OTP hash. Independent from the JWT secret. At least 32 characters. */
  otpHmacSecret: string;
  /** Which SMS backend delivers OTPs. `mock` is refused in production. */
  smsProvider: 'mock';
  /** Calling codes (digits only, no `+`) phone numbers may start with. */
  allowedPhoneCountryCodes: string[];
  /** Number of reverse proxies in front of the API, for correct client IPs. */
  trustProxyHops: number;
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

const callingCodesSchema = z
  .string()
  .default('94')
  .transform((value, ctx) => {
    const codes = value
      .split(',')
      .map((code) => code.trim())
      .filter((code) => code.length > 0);

    if (codes.length === 0 || codes.some((code) => !/^[1-9][0-9]{0,2}$/.test(code))) {
      ctx.issues.push({
        code: 'custom',
        message: 'must be a comma-separated list of calling codes without "+", like 94',
        input: value,
      });
      return z.NEVER;
    }
    return codes;
  });

const secretSchema = z
  .string({ error: 'is required' })
  .min(32, { error: 'must be at least 32 characters (generate with: openssl rand -base64 48)' });

/** SMS backends that only make sense on a developer machine (they expose OTPs). */
const DEVELOPMENT_ONLY_SMS_PROVIDERS: readonly string[] = ['mock'];

const envShape = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string({ error: 'is required' })
    .refine(isPostgresUrl, { error: 'must be a postgres:// or postgresql:// URL' }),
  CORS_ORIGINS: corsOriginsSchema,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JWT_ACCESS_SECRET: secretSchema,
  OTP_HMAC_SECRET: secretSchema,
  SMS_PROVIDER: z.enum(['mock']).default('mock'),
  ALLOWED_PHONE_COUNTRY_CODES: callingCodesSchema,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
};

const envSchema = z.object(envShape).check((ctx) => {
  const env = ctx.value;
  // (Only reported once both are long enough; otherwise the length errors say it all.)
  if (env.JWT_ACCESS_SECRET === env.OTP_HMAC_SECRET && env.JWT_ACCESS_SECRET.length >= 32) {
    ctx.issues.push({
      code: 'custom',
      message: 'OTP_HMAC_SECRET must differ from JWT_ACCESS_SECRET',
      path: ['OTP_HMAC_SECRET'],
      input: env.OTP_HMAC_SECRET,
    });
  }
  if (env.NODE_ENV === 'production') {
    if (DEVELOPMENT_ONLY_SMS_PROVIDERS.includes(env.SMS_PROVIDER)) {
      ctx.issues.push({
        code: 'custom',
        message: 'the mock SMS provider is not allowed in production',
        path: ['SMS_PROVIDER'],
        input: env.SMS_PROVIDER,
      });
    }
    for (const name of ['JWT_ACCESS_SECRET', 'OTP_HMAC_SECRET'] as const) {
      if (env[name].includes('replace-with')) {
        ctx.issues.push({
          code: 'custom',
          message: 'still contains the .env.example placeholder; set a real random secret',
          path: [name],
          input: env[name],
        });
      }
    }
  }
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
 * values, because DATABASE_URL and the secrets are credentials.
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
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    otpHmacSecret: env.OTP_HMAC_SECRET,
    smsProvider: env.SMS_PROVIDER,
    allowedPhoneCountryCodes: env.ALLOWED_PHONE_COUNTRY_CODES,
    trustProxyHops: env.TRUST_PROXY_HOPS,
  };
}

/** The subset of configuration needed by database tooling (migrate, seed, purge). */
export interface DatabaseToolConfig {
  nodeEnv: AppConfig['nodeEnv'];
  databaseUrl: string;
}

const databaseToolSchema = z.object({
  NODE_ENV: envShape.NODE_ENV,
  DATABASE_URL: envShape.DATABASE_URL,
});

/**
 * Like {@link loadEnv} but only requires what database scripts need, so running
 * a migration does not demand the authentication secrets.
 */
export function loadDatabaseEnv(source: NodeJS.ProcessEnv = process.env): DatabaseToolConfig {
  const result = databaseToolSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
    );
  }
  return { nodeEnv: result.data.NODE_ENV, databaseUrl: result.data.DATABASE_URL };
}
