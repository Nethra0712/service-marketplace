import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import type { AppConfig } from './config/env.js';
import type { Database } from './db/client.js';
import { systemClock, type Clock } from './lib/clock.js';
import type { Logger } from './lib/logger.js';
import type { RateLimitPolicy } from './middleware/ip-rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createAdminModule } from './modules/admin/index.js';
import { createAuthModule, type AuthPolicy, type Authenticator } from './modules/auth/index.js';
import { createBookingsModule } from './modules/bookings/index.js';
import { createCatalogueModule } from './modules/catalogue/index.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createMatchingModule } from './modules/matching/index.js';
import { createNotificationsModule } from './modules/notifications/index.js';
import { createPaymentsModule } from './modules/payments/index.js';
import { createProvidersModule } from './modules/providers/index.js';
import type { BookingAccessLookup } from './modules/realtime/index.js';
import { createReviewsModule } from './modules/reviews/index.js';
import type { SmsProvider } from './modules/sms/index.js';

/** Largest JSON request body accepted. Raise per-route later if a feature needs it. */
const JSON_BODY_LIMIT = '100kb';

/** Only echo a caller-supplied request id if it is short and harmless. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export interface AppDependencies {
  config: Pick<
    AppConfig,
    | 'corsOrigins'
    | 'jwtAccessSecret'
    | 'otpHmacSecret'
    | 'allowedPhoneCountryCodes'
    | 'trustProxyHops'
    | 'nodeEnv'
    | 'paymentProvider'
    | 'platformCommissionBasisPoints'
    | 'publicApiBaseUrl'
    | 'payhere'
    | 'pushProvider'
    | 'fcm'
    | 'adminJwtSecret'
  >;
  logger: Logger;
  db: Database;
  pingDatabase: () => Promise<void>;
  sms: SmsProvider;
  /** Defaults to the system clock. Tests inject a controllable one. */
  clock?: Clock;
  /** Overrides individual authentication policy values. Tests use tiny limits. */
  authPolicy?: Partial<AuthPolicy>;
  /** Per-IP limit on the public catalogue endpoints. */
  catalogueRateLimit?: RateLimitPolicy;
}

/**
 * The cross-module functions the realtime module needs, handed back
 * alongside the Express app rather than built into it: Socket.IO attaches to
 * the `http.Server` that wraps this app, which does not exist until the
 * caller creates one (see `server.ts`), so the realtime module itself is
 * created a level up, not in here.
 */
export interface RealtimeDependencies {
  authenticate: Authenticator;
  findBookingAccess: BookingAccessLookup;
  findProviderProfileId: (userId: string) => Promise<string | undefined>;
}

export interface CreateAppResult {
  app: Express;
  realtime: RealtimeDependencies;
  /**
   * Wires the realtime module's cache-eviction hook into the bookings
   * module, once the caller has actually built the realtime module (which
   * needs the `http.Server` this function's caller creates — see
   * {@link RealtimeDependencies}'s own doc comment). A no-op until called,
   * which is harmless: nothing can be caching a location for a booking
   * before the realtime module exists to accept one.
   */
  onRealtimeReady: (forgetBooking: (bookingId: string) => void) => void;
}

/**
 * Builds the Express app. It takes its dependencies as arguments, with no
 * globals or side effects, so tests can create as many isolated instances as
 * they need.
 */
export function createApp({
  config,
  logger,
  db,
  pingDatabase,
  sms,
  clock = systemClock,
  authPolicy,
  catalogueRateLimit,
}: AppDependencies): CreateAppResult {
  const app = express();

  // A forward reference to the realtime module's `forgetBooking`, resolved
  // once it exists (see `CreateAppResult.onRealtimeReady`'s doc comment).
  // Calling it before that happens is a safe no-op.
  let forgetTrackedBooking: (bookingId: string) => void = () => {
    /* no realtime module yet */
  };

  // Behind a load balancer the client address comes from X-Forwarded-For. Trust
  // exactly the configured number of hops, otherwise per-IP limits would
  // either see only the proxy or be spoofable.
  if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Health probes run constantly; logging each would drown real traffic.
      autoLogging: { ignore: (req) => req.url.startsWith('/api/health') },
    }),
  );
  app.use(helmet()); // also removes the X-Powered-By header
  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
      // The admin dashboard authenticates with a cookie (see modules/admin),
      // which a browser only attaches to a cross-origin request when the
      // server explicitly allows credentials — the mobile app's Bearer
      // tokens need no such thing, so this is harmless for it.
      credentials: true,
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use('/api/health', createHealthRouter({ pingDatabase }));

  const auth = createAuthModule({ db, sms, logger, clock, policy: authPolicy, config });
  app.use('/api/auth', auth.router);

  const providers = createProvidersModule({ db, clock, requireAuth: auth.requireAuth });
  app.use('/api/provider', providers.router);

  // Public, read-only catalogue (/api/cities, /api/service-categories).
  const catalogue = createCatalogueModule({
    db,
    countBookableProviders: providers.service.countBookableProviders,
    rateLimit: catalogueRateLimit,
  });
  app.use('/api', catalogue.router);

  // Automatic provider matching. Has no routes of its own: the bookings
  // module drives it internally on create, decline, release and expiry.
  const matching = createMatchingModule({
    findDispatchCandidates: providers.service.listDispatchCandidates,
  });

  // Created before bookings and payments: both notify through it on their own
  // events, but it never needs anything back from either.
  const notifications = createNotificationsModule({
    db,
    clock,
    logger,
    config,
    requireAuth: auth.requireAuth,
  });
  app.use('/api/notifications', notifications.router);

  // Created before bookings: bookings drives payment creation on completion
  // (see `onBookingCompleted` below), but payments never needs anything back
  // from the bookings module — it reads booking data directly.
  const payments = createPaymentsModule({
    db,
    clock,
    logger,
    config,
    requireAuth: auth.requireAuth,
    findProviderProfileId: providers.service.findProviderProfileId,
    findProviderUserId: providers.service.findProviderUserId,
    onPaymentEvent: (event) => notifications.service.notify(event),
  });

  const bookings = createBookingsModule({
    db,
    clock,
    logger,
    requireAuth: auth.requireAuth,
    findOfferedCategory: catalogue.service.findOfferedCategory,
    findProviderProfileId: providers.service.findProviderProfileId,
    findProviderUserId: providers.service.findProviderUserId,
    isBookable: providers.service.isBookable,
    findNextWave: matching.service.findNextWave,
    onBookingCompleted: async (booking) => {
      await payments.service.createPaymentForCompletedBooking(booking.id);
    },
    notifyBookingEvent: (event) => notifications.service.notify(event),
    onBookingEnded: (bookingId) => {
      forgetTrackedBooking(bookingId);
    },
  });
  app.use('/api/bookings', bookings.router);
  // Payment routes nested under a booking (checkout, view) — a second router
  // mounted at the same prefix, on paths the bookings router does not use.
  app.use('/api/bookings', payments.bookingRouter);
  // The gateway's own callback endpoint. Public — see its doc comment.
  app.use('/api/payments', payments.webhookRouter);

  // Review routes nested under a booking (submit, view) — a third router at
  // the same prefix, on paths neither of the above uses.
  const reviews = createReviewsModule({ db, clock, requireAuth: auth.requireAuth });
  app.use('/api/bookings', reviews.bookingRouter);
  app.use('/api/reviews', reviews.providerRouter);

  // The admin dashboard. Owns its own authentication (a cookie session, not
  // the mobile app's Bearer tokens) and every route under it is
  // authorization-gated server-side — see modules/admin's own doc comment.
  const admin = createAdminModule({
    db,
    clock,
    config,
    providerReview: providers.review,
    payments: payments.service,
    reviews: reviews.service,
  });
  app.use('/api/admin', admin.router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    realtime: {
      authenticate: auth.authenticate,
      findBookingAccess: bookings.service.findAccess,
      findProviderProfileId: providers.service.findProviderProfileId,
    },
    onRealtimeReady: (forgetBooking) => {
      forgetTrackedBooking = forgetBooking;
    },
  };
}
