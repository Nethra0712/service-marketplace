import { describe, expect, it } from 'vitest';

import { calculateCommission } from '../../src/modules/payments/commission.js';

describe('calculateCommission', () => {
  it("matches the brief's own worked example: 10,000 at 15% -> 1,500 commission, 8,500 earning", () => {
    expect(calculateCommission('10000.00', 1500)).toEqual({
      serviceAmount: '10000.00',
      commissionAmount: '1500.00',
      providerEarningAmount: '8500.00',
    });
  });

  it('the commission and provider earning always sum exactly to the service amount', () => {
    // Amounts and rates chosen to be awkward for floating-point/rounding.
    const cases: [string, number][] = [
      ['999.99', 1500],
      ['0.01', 1],
      ['33.33', 3333],
      ['12345.67', 999],
      ['7.77', 7777],
      ['10000000.00', 10000],
    ];
    for (const [amount, bps] of cases) {
      const { commissionAmount, providerEarningAmount, serviceAmount } = calculateCommission(
        amount,
        bps,
      );
      const sum = (Number(commissionAmount) * 100 + Number(providerEarningAmount) * 100) / 100;
      expect(sum).toBeCloseTo(Number(serviceAmount), 2);
    }
  });

  it('rounds the commission half up to the nearest cent, and the remainder lands with the provider (never inflating commission)', () => {
    // 33.33 * 15% = 4.9995 -> rounds to 5.00 commission, 28.33 to the provider.
    expect(calculateCommission('33.33', 1500)).toEqual({
      serviceAmount: '33.33',
      commissionAmount: '5.00',
      providerEarningAmount: '28.33',
    });
  });

  it('0 basis points takes no commission at all', () => {
    expect(calculateCommission('1000.00', 0)).toEqual({
      serviceAmount: '1000.00',
      commissionAmount: '0.00',
      providerEarningAmount: '1000.00',
    });
  });

  it('10000 basis points (100%) takes the entire amount as commission', () => {
    expect(calculateCommission('1000.00', 10_000)).toEqual({
      serviceAmount: '1000.00',
      commissionAmount: '1000.00',
      providerEarningAmount: '0.00',
    });
  });

  it('is configurable: a different rate produces a different split for the same amount', () => {
    const at10 = calculateCommission('1000.00', 1000);
    const at20 = calculateCommission('1000.00', 2000);
    expect(at10.commissionAmount).toBe('100.00');
    expect(at20.commissionAmount).toBe('200.00');
  });

  it.each([-1, 10_001])('rejects an out-of-range basis points value (%d)', (bps) => {
    expect(() => calculateCommission('100.00', bps)).toThrow(RangeError);
  });

  it.each(['0.00', '-5.00'])('rejects a non-positive service amount (%s)', (amount) => {
    expect(() => calculateCommission(amount, 1500)).toThrow(RangeError);
  });
});
