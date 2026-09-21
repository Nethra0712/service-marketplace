import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Hex SHA-256. For high-entropy inputs only (random tokens), never for passwords or OTPs. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Hex HMAC-SHA-256 keyed with a server secret. */
export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** A cryptographically random numeric code, zero-padded (e.g. "004821"). */
export function randomNumericCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += String(randomInt(0, 10));
  }
  return code;
}

/** A random URL-safe token with `bytes` bytes of entropy (256 bits by default). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time string comparison. Different lengths are simply unequal. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
