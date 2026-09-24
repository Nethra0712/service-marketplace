import type { Logger } from '../../lib/logger.js';
import type {
  CheckoutParams,
  CheckoutSession,
  PaymentProvider,
  RefundParams,
  RefundResult,
  VerifiedCallback,
} from './payment-provider.js';

const STATUSES = ['succeeded', 'failed', 'cancelled', 'pending'] as const;
type MockStatus = (typeof STATUSES)[number];

/** The fields a mock callback carries, before it is verified. */
export interface MockCallbackFields {
  orderId: string;
  providerPaymentId: string;
  status: MockStatus;
  amount: string;
  currency: string;
}

/**
 * DEVELOPMENT AND TEST ONLY. No real gateway is contacted and no real money
 * moves. `verifyCallback` still requires a deterministic "signature"
 * (`sign`), so tests exercise the same verify-then-trust shape a real
 * gateway integration has, even though nothing here is cryptographically
 * meaningful — the mock provider never actually crosses an untrusted
 * boundary, unlike a real webhook. Refused in production by `loadEnv` and
 * `createPaymentProvider`, the same way `MockSmsProvider` is.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  readonly checkouts: CheckoutParams[] = [];
  readonly refunds: RefundParams[] = [];

  constructor(private readonly logger?: Logger) {}

  createCheckout(params: CheckoutParams): Promise<CheckoutSession> {
    this.checkouts.push(params);
    this.logger?.info(
      { orderId: params.orderId, amount: params.amount },
      'MOCK payment checkout created (development only)',
    );
    return Promise.resolve({
      checkoutUrl: `mock://checkout/${params.orderId}`,
      fields: { orderId: params.orderId, amount: params.amount, currency: params.currency },
    });
  }

  verifyCallback(payload: Record<string, unknown>): VerifiedCallback | undefined {
    const orderId = typeof payload.orderId === 'string' ? payload.orderId : undefined;
    const providerPaymentId =
      typeof payload.providerPaymentId === 'string' ? payload.providerPaymentId : undefined;
    const amount = typeof payload.amount === 'string' ? payload.amount : undefined;
    const currency = typeof payload.currency === 'string' ? payload.currency : undefined;
    const signature = typeof payload.signature === 'string' ? payload.signature : undefined;
    const status = typeof payload.status === 'string' ? payload.status : undefined;
    if (!orderId || !providerPaymentId || !amount || !currency || !signature || !status) {
      return undefined;
    }
    if (!STATUSES.includes(status as MockStatus)) return undefined;

    const expected = MockPaymentProvider.sign({
      orderId,
      providerPaymentId,
      status: status as MockStatus,
      amount,
      currency,
    });
    if (signature !== expected) return undefined;

    return {
      orderId,
      providerPaymentId,
      status: status as MockStatus,
      amount,
      currency,
      raw: payload,
    };
  }

  refund(params: RefundParams): Promise<RefundResult> {
    this.refunds.push(params);
    return Promise.resolve({
      providerRefundId: `mock-refund-${this.refunds.length}`,
      raw: { ...params },
    });
  }

  /**
   * Produces a callback signature this provider will accept. Used by tests
   * and the dev-only "simulate a gateway callback" endpoint to build a
   * callback payload, standing in for what a real gateway would sign with
   * its merchant secret.
   */
  static sign(fields: MockCallbackFields): string {
    return [
      'mock',
      fields.orderId,
      fields.providerPaymentId,
      fields.status,
      fields.amount,
      fields.currency,
    ].join(':');
  }
}
