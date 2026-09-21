import { describe, expect, it } from 'vitest';

import {
  hmacSha256Hex,
  randomNumericCode,
  randomToken,
  safeEqual,
  sha256Hex,
} from '../../src/lib/crypto.js';
import { createLogger } from '../../src/lib/logger.js';
import { createSmsProvider, MockSmsProvider } from '../../src/modules/sms/index.js';

describe('crypto helpers', () => {
  it('computes SHA-256 correctly (known test vector)', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('computes HMAC-SHA-256 correctly (RFC 4231 test case 2)', () => {
    expect(hmacSha256Hex('Jefe', 'what do ya want for nothing?')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('gives different HMACs for different keys, so a leaked hash needs the server secret', () => {
    expect(hmacSha256Hex('key-one', '123456')).not.toBe(hmacSha256Hex('key-two', '123456'));
  });

  it('generates zero-padded numeric codes of the requested length', () => {
    const codes = Array.from({ length: 500 }, () => randomNumericCode(6));

    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
    // Leading zeros must survive: a naive Number-to-string would silently produce short codes.
    expect(codes.some((code) => code.startsWith('0'))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(450);
  });

  it('generates long, unique, URL-safe random tokens', () => {
    const tokens = Array.from({ length: 200 }, () => randomToken());

    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Set(tokens).size).toBe(200);
  });

  it('compares strings safely, including different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('createSmsProvider', () => {
  const logger = createLogger({ logLevel: 'silent' });

  it('returns the mock provider in development and test', () => {
    for (const nodeEnv of ['development', 'test'] as const) {
      expect(createSmsProvider({ smsProvider: 'mock', nodeEnv }, logger)).toBeInstanceOf(
        MockSmsProvider,
      );
    }
  });

  it('refuses to create the mock provider in production, where it would log OTPs', () => {
    expect(() => createSmsProvider({ smsProvider: 'mock', nodeEnv: 'production' }, logger)).toThrow(
      /production/,
    );
  });
});

describe('MockSmsProvider', () => {
  it('records messages and extracts the latest code per recipient', async () => {
    const sms = new MockSmsProvider();

    await sms.send({ to: '+94770000001', body: 'Your code is 111111.' });
    await sms.send({ to: '+94770000002', body: 'Your code is 222222.' });
    await sms.send({ to: '+94770000001', body: 'Your code is 333333.' });

    expect(sms.sent).toHaveLength(3);
    expect(sms.lastCodeTo('+94770000001')).toBe('333333');
    expect(sms.lastCodeTo('+94770000002')).toBe('222222');
    expect(sms.lastCodeTo('+94779999999')).toBeUndefined();
  });
});
