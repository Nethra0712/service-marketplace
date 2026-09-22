import { describe, expect, it } from 'vitest';

import { resolveLanguage } from '../../src/lib/language.js';

describe('resolveLanguage', () => {
  it('defaults to English', () => {
    expect(resolveLanguage({})).toBe('en');
    expect(resolveLanguage({ acceptLanguage: '' })).toBe('en');
  });

  it('honours an explicit ?lang above everything else', () => {
    expect(resolveLanguage({ queryLang: 'ta', acceptLanguage: 'si' })).toBe('ta');
    expect(resolveLanguage({ queryLang: 'en', acceptLanguage: 'si' })).toBe('en');
  });

  it('ignores an unsupported ?lang and falls back to the header', () => {
    expect(resolveLanguage({ queryLang: 'fr', acceptLanguage: 'si' })).toBe('si');
  });

  it.each([
    ['si', 'si'],
    ['ta', 'ta'],
    ['en-US', 'en'],
    ['si-LK', 'si'],
    ['SI', 'si'],
    ['si-LK,si;q=0.9,en;q=0.8', 'si'],
    ['fr,ta;q=0.7,en;q=0.5', 'ta'],
    ['en;q=0.5,si;q=0.9', 'si'],
    ['en;q=0.9,si;q=0.9', 'en'], // tie: the client's own order wins
    ['*', 'en'],
    ['fr-FR,de;q=0.8', 'en'],
    ['zz', 'en'],
  ])('resolves Accept-Language %j to %s', (header, expected) => {
    expect(resolveLanguage({ acceptLanguage: header })).toBe(expected);
  });

  it('skips languages the client explicitly refuses (q=0)', () => {
    expect(resolveLanguage({ acceptLanguage: 'si;q=0,ta;q=0.5' })).toBe('ta');
    expect(resolveLanguage({ acceptLanguage: 'si;q=0' })).toBe('en');
  });

  it('survives malformed headers', () => {
    for (const header of [';;;', ',,,', 'si;q=abc', 'q=1', '   ', 'si;;q=1']) {
      expect(() => resolveLanguage({ acceptLanguage: header })).not.toThrow();
    }
    expect(resolveLanguage({ acceptLanguage: 'si;q=abc' })).toBe('en');
  });
});
