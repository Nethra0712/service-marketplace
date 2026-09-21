import { z } from 'zod';

/** International format: "+", a non-zero digit, then 6 to 14 more digits. */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

/**
 * Builds the phone-number schema. Numbers must be E.164 (clients normalise
 * local formats) and start with an allowed calling code, which stops OTP SMS
 * being sent to arbitrary countries (SMS-pumping fraud).
 */
export function createAuthSchemas(allowedCountryCodes: readonly string[]) {
  const phone = z
    .string()
    .trim()
    .regex(E164_PATTERN, 'Enter a valid phone number in international format.')
    .refine(
      (value) => allowedCountryCodes.some((code) => value.startsWith(`+${code}`)),
      'Phone numbers from this country are not supported.',
    );

  const refreshToken = z.string().min(20).max(256);

  return {
    otpRequest: z.object({ body: z.strictObject({ phone }) }),
    otpVerify: z.object({
      body: z.strictObject({
        challengeId: z.uuid(),
        code: z.string().regex(/^\d{4,8}$/, 'The code must be numeric.'),
      }),
    }),
    refresh: z.object({ body: z.strictObject({ refreshToken }) }),
    logout: z.object({ body: z.strictObject({ refreshToken }) }),
  };
}

export type AuthSchemas = ReturnType<typeof createAuthSchemas>;
