import type { Router, RequestHandler } from 'express';

import type { AppConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import type { Logger } from '../../lib/logger.js';
import { createPaymentProvider } from './create-payment-provider.js';
import { createPaymentsBookingRouter, createPaymentsWebhookRouter } from './payments.routes.js';
import {
  createPaymentsService,
  type PaymentNotificationHook,
  type PaymentsService,
} from './payments.service.js';

export { calculateCommission, type CommissionBreakdown } from './commission.js';
export { MockPaymentProvider } from './mock-payment-provider.js';
export type { PaymentNotificationHook } from './payments.service.js';
export type { PaymentProvider } from './payment-provider.js';
export type { PaymentsService, PaymentView, PayoutView } from './payments.service.js';

export interface PaymentsModuleDeps {
  db: Database;
  clock: Clock;
  logger: Logger;
  config: Pick<
    AppConfig,
    'nodeEnv' | 'paymentProvider' | 'platformCommissionBasisPoints' | 'publicApiBaseUrl' | 'payhere'
  >;
  requireAuth: RequestHandler;
  findProviderProfileId: (userId: string) => Promise<string | undefined>;
  /** From the providers module: resolves a provider profile id to its owner's user id, for payout notifications. */
  findProviderUserId?: (providerProfileId: string) => Promise<string | undefined>;
  /** From the notifications module. */
  onPaymentEvent?: PaymentNotificationHook;
}

export interface PaymentsModule {
  /** Mount at /api/bookings, alongside the bookings module's own router. */
  bookingRouter: Router;
  /** Mount at /api/payments. Public (no auth) — the gateway's callback endpoint. */
  webhookRouter: Router;
  service: PaymentsService;
}

/** The payments module's public surface: other modules (and `bookings.service.ts`'s completion hook) import from here only. */
export function createPaymentsModule({
  db,
  clock,
  logger,
  config,
  requireAuth,
  findProviderProfileId,
  findProviderUserId,
  onPaymentEvent,
}: PaymentsModuleDeps): PaymentsModule {
  const provider = createPaymentProvider(
    { paymentProvider: config.paymentProvider, nodeEnv: config.nodeEnv, payhere: config.payhere },
    logger,
  );
  const service = createPaymentsService({
    db,
    clock,
    provider,
    commissionBasisPoints: config.platformCommissionBasisPoints,
    // Only used to build gateway callback URLs, which only a real gateway
    // ever calls back on; loadEnv only requires it when paymentProvider is
    // 'payhere', so this falls back harmlessly for `mock`.
    publicApiBaseUrl: config.publicApiBaseUrl ?? 'http://localhost:3000',
    findProviderUserId,
    onPaymentEvent,
    logger,
  });

  return {
    bookingRouter: createPaymentsBookingRouter({ service, requireAuth, findProviderProfileId }),
    webhookRouter: createPaymentsWebhookRouter({ service }),
    service,
  };
}
