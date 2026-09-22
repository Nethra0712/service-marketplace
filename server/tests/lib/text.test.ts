import { describe, expect, it } from 'vitest';

import { blankToNull } from '../../src/lib/text.js';

describe('blankToNull', () => {
  it('trims real text', () => {
    expect(blankToNull('  hello ')).toBe('hello');
  });

  it.each([undefined, null, '', '   ', '\n\t'])('turns %j into null', (value) => {
    expect(blankToNull(value)).toBeNull();
  });
});
