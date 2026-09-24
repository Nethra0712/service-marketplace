import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

// `promisify` alone cannot pick the (password, salt, keylen, options) overload
// out of scrypt's several signatures, so it is named explicitly here.
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/** scrypt cost parameters. Deliberately fixed, not configurable: changing them invalidates every stored hash. */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * Hashes a password with scrypt (Node's built-in, no extra dependency).
 * Format: `scrypt:N:r:p:<salt-hex>:<hash-hex>` — self-describing, so the cost
 * parameters can be raised later without invalidating passwords hashed under
 * the old ones.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(plain, salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt:${N}:${R}:${P}:${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Verifies a password against a hash produced by {@link hashPassword}.
 * Never throws on a malformed stored hash — treats it as a non-match, since
 * that can only mean data corruption, not a valid credential.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(saltHex ?? '', 'hex');
  const expected = Buffer.from(hashHex ?? '', 'hex');
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scrypt(plain, salt, expected.length, { N: n, r, p });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
