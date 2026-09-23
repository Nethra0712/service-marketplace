import { Router, type Request, type RequestHandler } from 'express';

import type { AppLanguage } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/language.js';
import { parseRequest } from '../../lib/validation.js';
import { getAuth } from '../auth/index.js';
import { bookingsSchemas } from './bookings.schemas.js';
import type { BookingsService } from './bookings.service.js';

export interface BookingsRoutesDeps {
  service: BookingsService;
  requireAuth: RequestHandler;
}

const languageOf = (req: Request, queryLang: AppLanguage | undefined): AppLanguage =>
  resolveLanguage({ queryLang, acceptLanguage: req.headers['accept-language'] });

/**
 * Bookings. Mounted at /api/bookings. Every route requires a signed-in user.
 *
 *   POST   /                            create a booking (customer) — triggers automatic dispatch
 *   GET    /mine                        my bookings, as a customer
 *   GET    /assigned                    my bookings, as a provider
 *   GET    /open                        my current dispatch offers (automatic matching, not a browse list)
 *   GET    /:id                         one booking (its customer, its assigned provider, or an offered provider)
 *   POST   /:id/accept                  provider accepts their offer directly (fixed/hourly only)
 *   POST   /:id/decline                 provider turns down their offer; dispatch moves on
 *   POST   /:id/en-route                provider: accepted -> en_route
 *   POST   /:id/arrived                 provider: en_route -> arrived
 *   POST   /:id/start                   provider: arrived -> in_progress
 *   POST   /:id/complete                provider: in_progress -> completed
 *   POST   /:id/release                 provider backs out (returns to searching; re-dispatches)
 *   POST   /:id/cancel                  customer cancels
 *   POST   /:id/quotes                  provider submits a quote (quote-priced, requires an offer)
 *   POST   /:id/quotes/:quoteId/accept  customer accepts a quote
 *   POST   /:id/quotes/:quoteId/reject  customer rejects a quote
 *
 * A provider can only act on a booking they currently hold (or have held) a
 * dispatch offer on: nobody browses and picks an arbitrary open request.
 *
 * Literal routes (`/mine`, `/assigned`, `/open`) are declared before `/:id` so
 * they are never swallowed by the parameter route.
 */
export function createBookingsRouter({ service, requireAuth }: BookingsRoutesDeps): Router {
  const router = Router();

  router.use(requireAuth);
  router.use((_req, res, next) => {
    // Personal data: never cached.
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/', async (req, res) => {
    const { query, body } = parseRequest(bookingsSchemas.create, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.status(201).json(await service.create(getAuth(req).userId, body, language));
  });

  router.get('/mine', async (req, res) => {
    const { query } = parseRequest(bookingsSchemas.list, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json({ items: await service.listForCustomer(getAuth(req).userId, language, query.status) });
  });

  router.get('/assigned', async (req, res) => {
    const { query } = parseRequest(bookingsSchemas.list, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json({ items: await service.listForProvider(getAuth(req).userId, language, query.status) });
  });

  router.get('/open', async (req, res) => {
    const { query } = parseRequest(bookingsSchemas.list, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json({ items: await service.listOffersForProvider(getAuth(req).userId, language) });
  });

  router.get('/:id', async (req, res) => {
    const { params, query } = parseRequest(bookingsSchemas.get, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.getForViewer(getAuth(req).userId, params.id, language));
  });

  router.post('/:id/accept', async (req, res) => {
    const { params, query } = parseRequest(bookingsSchemas.action, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.accept(getAuth(req).userId, params.id, language));
  });

  router.post('/:id/decline', async (req, res) => {
    const { params, query } = parseRequest(bookingsSchemas.action, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.decline(getAuth(req).userId, params.id, language));
  });

  router.post('/:id/en-route', async (req, res) => {
    const { params, query } = parseRequest(bookingsSchemas.action, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.startEnRoute(getAuth(req).userId, params.id, language));
  });

  router.post('/:id/arrived', async (req, res) => {
    const { params, query } = parseRequest(bookingsSchemas.action, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.markArrived(getAuth(req).userId, params.id, language));
  });

  router.post('/:id/start', async (req, res) => {
    const { params, query } = parseRequest(bookingsSchemas.action, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.startWork(getAuth(req).userId, params.id, language));
  });

  router.post('/:id/complete', async (req, res) => {
    const { params, query } = parseRequest(bookingsSchemas.action, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.complete(getAuth(req).userId, params.id, language));
  });

  router.post('/:id/release', async (req, res) => {
    const { params, query, body } = parseRequest(bookingsSchemas.release, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.release(getAuth(req).userId, params.id, body.reason, language));
  });

  router.post('/:id/cancel', async (req, res) => {
    const { params, query, body } = parseRequest(bookingsSchemas.cancel, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.cancel(getAuth(req).userId, params.id, body.reason, language));
  });

  router.post('/:id/quotes', async (req, res) => {
    const { params, query, body } = parseRequest(bookingsSchemas.submitQuote, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.status(201).json(await service.submitQuote(getAuth(req).userId, params.id, body, language));
  });

  router.post('/:id/quotes/:quoteId/accept', async (req, res) => {
    const { params, query } = parseRequest(bookingsSchemas.quoteDecision, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.acceptQuote(getAuth(req).userId, params.id, params.quoteId, language));
  });

  router.post('/:id/quotes/:quoteId/reject', async (req, res) => {
    const { params, query } = parseRequest(bookingsSchemas.quoteDecision, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.rejectQuote(getAuth(req).userId, params.id, params.quoteId, language));
  });

  return router;
}
