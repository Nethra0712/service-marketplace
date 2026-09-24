import { describe, expect, it } from 'vitest';

import { MockPaymentProvider } from '../../src/modules/payments/mock-payment-provider.js';

const params = {
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
};

describe('MockPaymentProvider', () => {
  it('records every checkout it is asked to create, and contacts no real gateway', async () => {
    const provider = new MockPaymentProvider();
    const session = await provider.createCheckout(params);
    expect(provider.checkouts).toEqual([params]);
    expect(session.checkoutUrl).toMatch(/^mock:\/\//);
  });

  it('verifies a correctly-signed callback', () => {
    const provider = new MockPaymentProvider();
    const fields = {
      orderId: 'SM-1',
      providerPaymentId: 'mock-pay-1',
      status: 'succeeded' as const,
      amount: '250.00',
      currency: 'LKR',
    };
    const payload = { ...fields, signature: MockPaymentProvider.sign(fields) };
    expect(provider.verifyCallback(payload)).toEqual({ ...fields, raw: payload });
  });

  it('rejects a callback with a wrong signature', () => {
    const provider = new MockPaymentProvider();
    const payload = {
      orderId: 'SM-1',
      providerPaymentId: 'mock-pay-1',
      status: 'succeeded',
      amount: '250.00',
      currency: 'LKR',
      signature: 'not-the-real-signature',
    };
    expect(provider.verifyCallback(payload)).toBeUndefined();
  });

  it.each(['orderId', 'providerPaymentId', 'amount', 'currency', 'status', 'signature'])(
    'rejects a callback missing "%s"',
    (missingField) => {
      const provider = new MockPaymentProvider();
      const fields = {
        orderId: 'SM-1',
        providerPaymentId: 'mock-pay-1',
        status: 'succeeded' as const,
        amount: '250.00',
        currency: 'LKR',
      };
      const payload = Object.fromEntries(
        Object.entries({ ...fields, signature: MockPaymentProvider.sign(fields) }).filter(
          ([key]) => key !== missingField,
        ),
      );
      expect(provider.verifyCallback(payload)).toBeUndefined();
    },
  );

  it('rejects a callback with an unrecognized status', () => {
    const provider = new MockPaymentProvider();
    const payload = {
      orderId: 'SM-1',
      providerPaymentId: 'mock-pay-1',
      status: 'unknown-status',
      amount: '250.00',
      currency: 'LKR',
      signature: 'irrelevant',
    };
    expect(provider.verifyCallback(payload)).toBeUndefined();
  });

  it('records a refund and returns a reference', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.refund({
      providerPaymentId: 'mock-pay-1',
      amount: '250.00',
      currency: 'LKR',
      reason: 'Customer requested',
    });
    expect(provider.refunds).toHaveLength(1);
    expect(result.providerRefundId).toBeTruthy();
  });
});
