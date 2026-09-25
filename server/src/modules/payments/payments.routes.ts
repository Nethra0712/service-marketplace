import express, { Router, type RequestHandler } from 'express';

import { getAuth } from '../auth/index.js';
import { createIpRateLimiter } from '../../middleware/ip-rate-limit.js';
import { parseRequest } from '../../lib/validation.js';
import { paymentsSchemas } from './payments.schemas.js';
import type { PaymentsService } from './payments.service.js';

/** Largest webhook body accepted. Gateway callbacks are a handful of short fields. */
const WEBHOOK_BODY_LIMIT = '20kb';

/**
 * Deliberately generous: the gateway calls this from its own, small pool of
 * server IPs, so many different customers' legitimate callbacks can arrive
 * from the same address in a short window. This is not meant to shape real
 * traffic — `handleCallback`'s signature check is what actually decides
 * whether a callback is trusted — only to cap the cost of someone flooding
 * an unauthenticated, publicly-reachable endpoint with garbage.
 */
const WEBHOOK_RATE_LIMIT = { windowMs: 60_000, limit: 300 };

export interface PaymentsRoutesDeps {
  service: PaymentsService;
  requireAuth: RequestHandler;
  /** From the providers module — authorizes the assigned-provider side of `GET /:id/payment`. */
  findProviderProfileId: (userId: string) => Promise<string | undefined>;
}

/**
 * Payment routes nested under a booking. Mounted at /api/bookings, alongside
 * (not instead of) the bookings module's own router — both match the same
 * prefix, on disjoint paths.
 *
 *   POST /:id/payment/checkout   customer starts (or resumes) paying
 *   GET  /:id/payment            customer or assigned provider views the current payment
 */
export function createPaymentsBookingRouter({
  service,
  requireAuth,
  findProviderProfileId,
}: PaymentsRoutesDeps): Router {
  const router = Router();
  router.use(requireAuth);
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store'); // Financial data: never cached.
    next();
  });

  router.post('/:id/payment/checkout', async (req, res) => {
    const { params } = parseRequest(paymentsSchemas.forBooking, req);
    res.status(201).json(await service.createCheckoutSession(getAuth(req).userId, params.id));
  });

  router.get('/:id/payment', async (req, res) => {
    const { params } = parseRequest(paymentsSchemas.forBooking, req);
    const payment = await service.getPaymentForViewer(
      getAuth(req).userId,
      params.id,
      findProviderProfileId,
    );
    if (!payment) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'No payment for this booking yet.' } });
      return;
    }
    res.json(payment);
  });

  return router;
}

/**
 * The gateway's callback endpoint. Deliberately gateway-agnostic in its own
 * path (`PaymentProvider#verifyCallback` is what actually knows PayHere's or
 * the mock provider's shape) and deliberately unauthenticated — a gateway
 * cannot present this app's own session tokens. Authenticity instead comes
 * from the callback's signature, checked inside `handleCallback` before
 * anything is trusted. Accepts both form-urlencoded (what PayHere sends) and
 * JSON (what the mock provider and tests use) bodies.
 */
export function createPaymentsWebhookRouter({ service }: { service: PaymentsService }): Router {
  const router = Router();
  router.use(express.urlencoded({ extended: false, limit: WEBHOOK_BODY_LIMIT }));
  router.use(express.json({ limit: WEBHOOK_BODY_LIMIT }));
  router.use(createIpRateLimiter(WEBHOOK_RATE_LIMIT));

  router.post('/webhook', async (req, res) => {
    const { body } = parseRequest(paymentsSchemas.webhook, req);
    await service.handleCallback(body);
    res.status(200).send('OK'); // PayHere expects a 200 acknowledgement, not a JSON body.
  });

  return router;
}
