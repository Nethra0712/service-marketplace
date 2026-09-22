import { Router, type Request } from 'express';

import type { AppLanguage } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/language.js';
import { parseRequest } from '../../lib/validation.js';
import { createIpRateLimiter, type RateLimitPolicy } from '../../middleware/ip-rate-limit.js';
import { catalogueSchemas } from './catalogue.schemas.js';
import type { CatalogueService } from './catalogue.service.js';

export interface CatalogueRoutesDeps {
  service: CatalogueService;
  rateLimit: RateLimitPolicy;
}

/** `?lang=` wins, then Accept-Language, then English. */
const languageOf = (req: Request, queryLang: AppLanguage | undefined): AppLanguage =>
  resolveLanguage({ queryLang, acceptLanguage: req.headers['accept-language'] });

/**
 * Public, read-only catalogue. Mounted under /api.
 *
 *   GET /cities
 *   GET /service-categories        ?q= &pricingModel= &city= &lang=
 *   GET /service-categories/:slug  ?city= &lang=
 *
 * No authentication: browsing what the marketplace offers is not sensitive, and
 * nothing here can change data. Inactive categories are simply absent.
 */
export function createCatalogueRouter({ service, rateLimit }: CatalogueRoutesDeps): Router {
  const router = Router();
  const limit = createIpRateLimiter(rateLimit);

  router.get('/cities', limit, async (_req, res) => {
    res.json({ items: await service.listCities() });
  });

  router.get('/service-categories', limit, async (req, res) => {
    const { query } = parseRequest(catalogueSchemas.categories, req);
    const language = languageOf(req, query.lang);

    res.vary('Accept-Language');
    res.json({
      language,
      items: await service.listCategories({
        language,
        search: query.q,
        pricingModel: query.pricingModel,
        citySlug: query.city,
      }),
    });
  });

  router.get('/service-categories/:slug', limit, async (req, res) => {
    const { params, query } = parseRequest(catalogueSchemas.category, req);
    const language = languageOf(req, query.lang);

    res.vary('Accept-Language');
    res.json({
      language,
      ...(await service.getCategory(params.slug, { language, citySlug: query.city })),
    });
  });

  return router;
}
