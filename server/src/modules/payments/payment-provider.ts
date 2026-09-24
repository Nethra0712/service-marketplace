/** What a checkout is for: never trust a client-supplied amount, but the gateway needs one to charge. */
export interface CheckoutParams {
  /** This app's own reference for the payment; sent to the gateway as its order id. */
  orderId: string;
  /** Decimal, 2dp, server-computed. */
  amount: string;
  currency: string;
  itemDescription: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    /** ISO 3166-1 country name as the gateway expects it, e.g. "Sri Lanka". */
    country: string;
  };
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

/**
 * Everything the client needs to actually start the checkout. For a
 * form-POST gateway (PayHere), `fields` are the form fields to submit to
 * `checkoutUrl`; they are safe to hand to the client — never the merchant
 * secret itself, only values already derived from it (e.g. a hash).
 */
export interface CheckoutSession {
  checkoutUrl: string;
  fields: Record<string, string>;
}

/** A gateway callback, once its signature has been checked and it can be trusted. */
export interface VerifiedCallback {
  /** This app's own reference, extracted from the callback (matches `CheckoutParams.orderId`). */
  orderId: string;
  providerPaymentId: string;
  status: 'succeeded' | 'failed' | 'cancelled' | 'pending';
  /** What the GATEWAY reports was charged. Cross-checked against our own stored amount; never trusted on its own. */
  amount: string;
  currency: string;
  /** The callback's raw payload, kept for the ledger. Never contains card/payment credentials. */
  raw: Record<string, unknown>;
}

export interface RefundParams {
  providerPaymentId: string;
  amount: string;
  currency: string;
  reason: string;
}

export interface RefundResult {
  providerRefundId: string | undefined;
  raw: unknown;
}

/**
 * The only thing the rest of the application knows about payment gateways.
 *
 * A real gateway is added by implementing this interface and registering it
 * in `createPaymentProvider`; nothing else changes. Business logic (who may
 * pay, how commission splits, idempotency, the ledger) lives in
 * `payments.service.ts` and never depends on a specific gateway's shape.
 */
export interface PaymentProvider {
  readonly name: 'mock' | 'payhere';
  createCheckout(params: CheckoutParams): Promise<CheckoutSession>;
  /**
   * Verifies a callback's authenticity and parses it. Returns `undefined` for
   * a callback that fails verification (a wrong/missing signature, or an
   * unrecognized shape) — that is an expected, not exceptional, case (e.g. a
   * forged or malformed request) and callers must never treat an
   * unverifiable callback as if it were valid.
   */
  verifyCallback(payload: Record<string, unknown>): VerifiedCallback | undefined;
  refund(params: RefundParams): Promise<RefundResult>;
}
