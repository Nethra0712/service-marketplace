import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { PayHereProvider } from '../../src/modules/payments/payhere-payment-provider.js';
import type { PaymentProvider } from '../../src/modules/payments/payment-provider.js';

const config = { merchantId: 'MERCHANT1', merchantSecret: 'top-secret', mode: 'sandbox' as const };

const md5Upper = (value: string) => createHash('md5').update(value).digest('hex').toUpperCase();

/** Builds a webhook payload PayHere would actually sign, for a given status code. */
function signedCallback(overrides: Partial<Record<string, string>> = {}) {
  const base = {
    merchant_id: config.merchantId,
    order_id: 'SM-1',
    payment_id: 'payhere-pay-1',
    payhere_amount: '250.00',
    payhere_currency: 'LKR',
    status_code: '2',
    ...overrides,
  };
  const secretHash = md5Upper(config.merchantSecret);
  const md5sig = md5Upper(
    `${base.merchant_id}${base.order_id}${base.payhere_amount}${base.payhere_currency}${base.status_code}${secretHash}`,
  );
  return { ...base, md5sig };
}

describe('PayHereProvider', () => {
  describe('createCheckout', () => {
    it('produces the documented hash: MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret))', async () => {
      const provider = new PayHereProvider(config);
      const session = await provider.createCheckout({
        orderId: 'SM-1',
        amount: '250.00',
        currency: 'LKR',
        itemDescription: 'Test booking',
        customer: {
          firstName: 'Nimal',
          lastName: 'Perera',
          email: 'test@customer.invalid',
          phone: '+94771234567',
          address: '1 Test Rd',
          city: 'Colombo',
          country: 'Sri Lanka',
        },
        returnUrl: 'http://localhost/return',
        cancelUrl: 'http://localhost/cancel',
        notifyUrl: 'http://localhost/notify',
      });

      const expectedHash = md5Upper(
        `${config.merchantId}SM-1250.00LKR${md5Upper(config.merchantSecret)}`,
      );
      expect(session.fields.hash).toBe(expectedHash);
      expect(session.fields.merchant_id).toBe(config.merchantId);
      expect(session.fields.amount).toBe('250.00');
      expect(session.checkoutUrl).toBe('https://sandbox.payhere.lk/pay/checkout');
      // Never leaks the merchant secret itself, only a value derived from it.
      expect(Object.values(session.fields)).not.toContain(config.merchantSecret);
    });

    it('uses the live checkout URL in live mode', async () => {
      const provider = new PayHereProvider({ ...config, mode: 'live' });
      const session = await provider.createCheckout({
        orderId: 'SM-1',
        amount: '100.00',
        currency: 'LKR',
        itemDescription: 'x',
        customer: {
          firstName: 'A',
          lastName: 'B',
          email: 'a@b.invalid',
          phone: '+94771234567',
          address: 'x',
          city: 'Colombo',
          country: 'Sri Lanka',
        },
        returnUrl: 'http://localhost/return',
        cancelUrl: 'http://localhost/cancel',
        notifyUrl: 'http://localhost/notify',
      });
      expect(session.checkoutUrl).toBe('https://www.payhere.lk/pay/checkout');
    });
  });

  describe('verifyCallback', () => {
    it.each([
      ['2', 'succeeded'],
      ['0', 'pending'],
      ['-1', 'cancelled'],
      ['-2', 'failed'],
      ['-3', 'failed'], // chargeback
    ] as const)('maps status_code %s to %s', (statusCode, expected) => {
      const provider = new PayHereProvider(config);
      const payload = signedCallback({ status_code: statusCode });
      expect(provider.verifyCallback(payload)).toMatchObject({
        orderId: 'SM-1',
        providerPaymentId: 'payhere-pay-1',
        status: expected,
        amount: '250.00',
        currency: 'LKR',
      });
    });

    it('rejects a callback with a wrong signature', () => {
      const provider = new PayHereProvider(config);
      const payload = { ...signedCallback(), md5sig: 'not-the-real-signature' };
      expect(provider.verifyCallback(payload)).toBeUndefined();
    });

    it('rejects a callback for a different merchant id', () => {
      const provider = new PayHereProvider(config);
      const payload = signedCallback({ merchant_id: 'SOMEONE_ELSE' });
      expect(provider.verifyCallback(payload)).toBeUndefined();
    });

    it('rejects a callback whose amount was tampered with after signing', () => {
      const provider = new PayHereProvider(config);
      const signed = signedCallback();
      const tampered = { ...signed, payhere_amount: '999999.00' };
      expect(provider.verifyCallback(tampered)).toBeUndefined();
    });

    it.each([
      'merchant_id',
      'order_id',
      'payment_id',
      'payhere_amount',
      'payhere_currency',
      'status_code',
      'md5sig',
    ])('rejects a callback missing "%s"', (missingField) => {
      const provider = new PayHereProvider(config);
      const payload = Object.fromEntries(
        Object.entries(signedCallback()).filter(([key]) => key !== missingField),
      );
      expect(provider.verifyCallback(payload)).toBeUndefined();
    });

    it('rejects an unrecognized status code', () => {
      const provider = new PayHereProvider(config);
      const payload = signedCallback({ status_code: '999' });
      // A hash computed over an unrecognized status code will not itself be
      // wrong, but the mapped status is: verifyCallback must still refuse it.
      expect(provider.verifyCallback(payload)).toBeUndefined();
    });
  });

  describe('refund', () => {
    it('is not implemented against the real API and rejects clearly rather than pretending to succeed', async () => {
      const provider: PaymentProvider = new PayHereProvider(config);
      await expect(
        provider.refund({
          providerPaymentId: 'payhere-pay-1',
          amount: '250.00',
          currency: 'LKR',
          reason: 'test',
        }),
      ).rejects.toThrow(/PayHere refund API/);
    });
  });
});
