import { Router, type Request, type RequestHandler } from 'express';

import type { AppLanguage } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/language.js';
import { parseRequest } from '../../lib/validation.js';
import { getAuth } from '../auth/index.js';
import { providersSchemas } from './providers.schemas.js';
import type { ProvidersService } from './providers.service.js';

export interface ProvidersRoutesDeps {
  service: ProvidersService;
  requireAuth: RequestHandler;
}

const languageOf = (req: Request, queryLang: AppLanguage | undefined): AppLanguage =>
  resolveLanguage({ queryLang, acceptLanguage: req.headers['accept-language'] });

/**
 * Provider self-service. Mounted at /api/provider. EVERY route requires a signed-in
 * user and acts only on that user's own provider profile.
 *
 *   GET    /profile                  my provider profile (404 if I have none)
 *   PUT    /profile                  create or update it (becoming a provider)
 *   POST   /profile/submit           hand the profile in for review
 *   GET    /services                 my category applications and their status
 *   POST   /services                 apply for a category in a city
 *   GET    /services/:id             one application
 *   POST   /services/:id/resubmit    re-apply after a rejection
 *   DELETE /services/:id             withdraw a pending or rejected application
 *
 * Approving, rejecting or suspending is intentionally not exposed here.
 */
export function createProvidersRouter({ service, requireAuth }: ProvidersRoutesDeps): Router {
  const router = Router();

  router.use(requireAuth);
  router.use((_req, res, next) => {
    // Personal data: never cached.
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/profile', async (req, res) => {
    parseRequest(providersSchemas.getProfile, req);
    res.json(await service.getProfile(getAuth(req).userId));
  });

  router.put('/profile', async (req, res) => {
    const { body } = parseRequest(providersSchemas.saveProfile, req);
    const { profile, created } = await service.saveProfile(getAuth(req).userId, body);
    res.status(created ? 201 : 200).json(profile);
  });

  router.post('/profile/submit', async (req, res) => {
    parseRequest(providersSchemas.submitProfile, req);
    res.json(await service.submitProfile(getAuth(req).userId));
  });

  router.get('/services', async (req, res) => {
    const { query } = parseRequest(providersSchemas.listApplications, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json({ items: await service.listApplications(getAuth(req).userId, language) });
  });

  router.post('/services', async (req, res) => {
    const { query, body } = parseRequest(providersSchemas.apply, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.status(201).json(await service.apply(getAuth(req).userId, body, language));
  });

  router.get('/services/:id', async (req, res) => {
    const { params, query } = parseRequest(providersSchemas.application, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.getApplication(getAuth(req).userId, params.id, language));
  });

  router.post('/services/:id/resubmit', async (req, res) => {
    const { params, query } = parseRequest(providersSchemas.application, req);
    const language = languageOf(req, query.lang);
    res.vary('Accept-Language');
    res.json(await service.resubmitApplication(getAuth(req).userId, params.id, language));
  });

  router.delete('/services/:id', async (req, res) => {
    const { params } = parseRequest(providersSchemas.application, req);
    await service.withdrawApplication(getAuth(req).userId, params.id);
    res.status(204).end();
  });

  return router;
}
