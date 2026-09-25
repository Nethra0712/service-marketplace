import { createHash } from 'node:crypto';

import { safeEqual } from '../../lib/crypto.js';
import type {
  CheckoutParams,
  CheckoutSession,
  PaymentProvider,
  RefundResult,
  VerifiedCallback,
} from './payment-provider.js';

export interface PayHereConfig {
  merchantId: string;
  merchantSecret: string;
  mode: 'sandbox' | 'live';
}

const CHECKOUT_URL: Record<PayHereConfig['mode'], string> = {
  sandbox: 'https://sandbox.payhere.lk/pay/checkout',
  live: 'https://www.payhere.lk/pay/checkout',
};

/** PayHere's notify_url status codes. See https://support.payhere.lk/api-&-mobile-sdk/payhere-checkout#notify_url */
const STATUS_CODE: Record<string, VerifiedCallback['status']> = {
  '2': 'succeeded',
  '0': 'pending',
  '-1': 'cancelled',
  '-2': 'failed',
  // Chargeback on an already-settled payment. Modelled as a failure so it
  // never silently overwrites a `succeeded` payment with a same-shaped
  // update: `payments.service.ts`'s idempotent update only ever moves a
  // payment out of `pending`, so a chargeback callback on an
  // already-`succeeded` payment is a no-op there, logged, not applied.
  '-3': 'failed',
};

const md5Upper = (value: string): string =>
  createHash('md5').update(value).digest('hex').toUpperCase();

const stringField = (payload: Record<string, unknown>, key: string): string | undefined => {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/**
 * Real PayHere integration. Checkout-hash generation and webhook signature
 * verification both follow PayHere's documented MD5 scheme exactly. `refund`
 * is structurally complete but not wired to PayHere's Refund API, which uses
 * a separate OAuth (app id/secret) flow this environment has no credentials
 * to exercise or test against — it throws clearly rather than pretending to
 * succeed. Refunds run through the mock provider in dev/test (see
 * `payments.service.ts`'s doc comment on `refundPayment`).
 */
export class PayHereProvider implements PaymentProvider {
  readonly name = 'payhere' as const;

  constructor(private readonly config: PayHereConfig) {}

  private secretHash(): string {
    return md5Upper(this.config.merchantSecret);
  }

  createCheckout(params: CheckoutParams): Promise<CheckoutSession> {
    const amount = Number(params.amount).toFixed(2);
    const hash = md5Upper(
      `${this.config.merchantId}${params.orderId}${amount}${params.currency}${this.secretHash()}`,
    );
    return Promise.resolve({
      checkoutUrl: CHECKOUT_URL[this.config.mode],
      fields: {
        merchant_id: this.config.merchantId,
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        notify_url: params.notifyUrl,
        order_id: params.orderId,
        items: params.itemDescription,
        currency: params.currency,
        amount,
        first_name: params.customer.firstName,
        last_name: params.customer.lastName,
        email: params.customer.email,
        phone: params.customer.phone,
        address: params.customer.address,
        city: params.customer.city,
        country: params.customer.country,
        hash,
      },
    });
  }

  verifyCallback(payload: Record<string, unknown>): VerifiedCallback | undefined {
    const merchantId = stringField(payload, 'merchant_id');
    const orderId = stringField(payload, 'order_id');
    const providerPaymentId = stringField(payload, 'payment_id');
    const amount = stringField(payload, 'payhere_amount');
    const currency = stringField(payload, 'payhere_currency');
    const statusCode = stringField(payload, 'status_code');
    const md5sig = stringField(payload, 'md5sig');
    if (
      !merchantId ||
      !orderId ||
      !providerPaymentId ||
      !amount ||
      !currency ||
      !statusCode ||
      !md5sig
    ) {
      return undefined;
    }
    if (merchantId !== this.config.merchantId) return undefined;

    const expected = md5Upper(
      `${merchantId}${orderId}${amount}${currency}${statusCode}${this.secretHash()}`,
    );
    if (!safeEqual(expected, md5sig.toUpperCase())) return undefined;

    const status = STATUS_CODE[statusCode];
    if (!status) return undefined;

    return { orderId, providerPaymentId, status, amount, currency, raw: payload };
  }

  refund(): Promise<RefundResult> {
    return Promise.reject(
      new Error(
        'PayHere refund API integration requires app-level OAuth credentials not configured in this environment. ' +
          'Refunds are only available through the mock payment provider until that integration is built.',
      ),
    );
  }
}
