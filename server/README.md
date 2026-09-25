# Service Marketplace: server

Backend API for the Service Marketplace platform: authentication (OTP over
SMS), the booking lifecycle, automatic provider matching/dispatch, live
location tracking over Socket.IO, payments and commission (PayHere),
provider payouts, reviews, push notifications, and a separate admin API for
the [admin dashboard](../admin/README.md).

Stack: Node.js, TypeScript (strict), Express 5, PostgreSQL, Drizzle ORM,
Zod v4, `jose` (JWT), Socket.IO, Pino (logging), Vitest (tests, 940+ of
them).

## Requirements

- Node.js 22.12 or newer
- PostgreSQL 15+

## First-time setup

```bash
npm install
cp .env.example .env        # then edit .env: see "Environment variables" below
createdb service_marketplace
createdb service_marketplace_test     # used only by the test suite
npm run db:migrate
npm run db:seed             # optional: development example data (categories, cities)
```

Create your first admin account (the only way to get one — see
[Admin accounts](#admin-accounts) below):

```bash
npm run admin:create -- you@example.com "a-strong-password-123" "Your Name"
```

Start the API:

```bash
npm run dev        # auto-reloading
# or: npm run build && npm start
```

```bash
curl http://localhost:3000/api/health      # process is up
curl http://localhost:3000/api/health/db   # can reach PostgreSQL
```

## Environment variables

Validated at startup with Zod. The server refuses to start, printing which
variables are wrong but **never their values**, if any are invalid. See
`.env.example` for the full annotated list; summary below.

| Variable                                                           | Required     | Default       | Notes                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                     | yes          |               | `postgres://`/`postgresql://` URL. Contains credentials — keep it secret.                                                                                                                                   |
| `DATABASE_URL_TEST`                                                | tests only   |               | Must end in `_test`; the test runner refuses anything else (it truncates tables in it).                                                                                                                     |
| `NODE_ENV`                                                         | no           | `development` | `development`, `test`, or `production`. Several settings below are refused in `production` if left at their dev defaults.                                                                                   |
| `PORT`                                                             | no           | `3000`        |                                                                                                                                                                                                             |
| `CORS_ORIGINS`                                                     | no           | empty         | Comma-separated exact browser origins (e.g. the admin app's URL). Empty means no cross-origin browser access at all — the mobile app doesn't need this, it isn't a browser.                                 |
| `LOG_LEVEL`                                                        | no           | `info`        | `fatal`..`trace`, or `silent`.                                                                                                                                                                              |
| `TRUST_PROXY_HOPS`                                                 | no           | `0`           | Number of reverse-proxy hops in front of the API. Needed for correct per-IP rate limiting behind a load balancer.                                                                                           |
| `JWT_ACCESS_SECRET`                                                | yes          |               | ≥32 chars. Signs the mobile app's access tokens.                                                                                                                                                            |
| `OTP_HMAC_SECRET`                                                  | yes          |               | ≥32 chars, **different** from the other two secrets. Hashes OTP codes at rest.                                                                                                                              |
| `ADMIN_JWT_SECRET`                                                 | yes          |               | ≥32 chars, **different** from the other two. Signs the admin dashboard's session cookie — a completely separate token system from the mobile app's (see [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)). |
| `SMS_PROVIDER`                                                     | no           | `mock`        | Only `mock` exists today (prints the OTP to the server log; sends nothing). Refused when `NODE_ENV=production`.                                                                                             |
| `ALLOWED_PHONE_COUNTRY_CODES`                                      | no           | `94`          | Comma-separated calling codes (no `+`) phone numbers may start with.                                                                                                                                        |
| `PAYMENT_PROVIDER`                                                 | no           | `mock`        | `mock` or `payhere`. `mock` is refused in production.                                                                                                                                                       |
| `PLATFORM_COMMISSION_BASIS_POINTS`                                 | no           | `1500`        | 1500 = 15.00%. The only place commission is ever computed from — never hardcoded, never client-supplied.                                                                                                    |
| `PUBLIC_API_BASE_URL`                                              | payhere only |               | This API's own reachable base URL, for building PayHere's return/cancel/notify URLs.                                                                                                                        |
| `PAYHERE_MERCHANT_ID` / `PAYHERE_MERCHANT_SECRET` / `PAYHERE_MODE` | payhere only |               | PayHere merchant credentials. Never commit real values.                                                                                                                                                     |
| `PUSH_PROVIDER`                                                    | no           | `mock`        | `mock` or `fcm`. `mock` is refused in production.                                                                                                                                                           |
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY`          | fcm only     |               | Firebase Admin SDK service-account credentials. `FCM_PRIVATE_KEY` keeps its newlines escaped as literal `\n`, the way the downloaded JSON has them.                                                         |

`.env` is git-ignored. Never commit real credentials; only `.env.example`
belongs in Git. Generate each secret independently with
`openssl rand -base64 48`.

## Admin accounts

There is deliberately no HTTP endpoint that creates an admin account — see
[`src/modules/admin/create-admin.ts`](src/modules/admin/create-admin.ts)'s
own doc comment. The only way to create one is:

```bash
npm run admin:create -- email@example.com "a-strong-password" "Full Name"
```

This works in every environment, including production (it's a deploy-time
operational task, not a dev convenience). Admin login also has both a
per-IP and a per-account rate limit; ten consecutive failed logins locks
the account for 15 minutes.

## Scripts

| Script                 | Purpose                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`          | Run with auto-reload                                                                                                                                         |
| `npm run build`        | Compile to `dist/` and copy the SQL migrations                                                                                                               |
| `npm start`            | Run the compiled server                                                                                                                                      |
| `npm run typecheck`    | TypeScript strict check (source and tests)                                                                                                                   |
| `npm run lint`         | ESLint (type-aware, strict — applies to tests too)                                                                                                           |
| `npm run format:check` | Prettier check (`npm run format` to fix)                                                                                                                     |
| `npm test`             | Vitest — 59 files, 940+ tests, against `DATABASE_URL_TEST`                                                                                                   |
| `npm run db:generate`  | Generate a migration from schema changes (`drizzle-kit`)                                                                                                     |
| `npm run db:migrate`   | Apply pending migrations to `DATABASE_URL`                                                                                                                   |
| `npm run db:seed`      | Load development example data (refuses `NODE_ENV=production`)                                                                                                |
| `npm run admin:create` | Create an admin account — see above                                                                                                                          |
| `npm run auth:purge`   | Delete expired/revoked auth sessions and refresh tokens past their retention window                                                                          |
| `npm run dev:review`   | Dev-only CLI to approve/reject/suspend a provider, without the admin dashboard running                                                                       |
| `npm run dev:payouts`  | Runs `calculatePayoutsForPeriod` for a given period — there is no scheduler in this codebase (see below), so this is invoked manually or by an external cron |

## Layout

```
server/
  src/
    config/        env validation (Zod) and .env loading
    db/
      schema/      Drizzle table definitions, one file per table
      migrations/  generated SQL + hand-written SQL (triggers)
      seed/        development-only example data
      client.ts    pg pool + Drizzle instance, ping and shutdown helpers
    lib/            errors, logger, crypto, validation, clock, timeout helpers
    middleware/     error handler, 404 handler, per-IP rate limiter
    modules/        one folder per feature area — see below
    app.ts          builds the Express app from injected dependencies (no globals)
    server.ts       process entry point: config, HTTP + Socket.IO listen, graceful shutdown
  tests/            Vitest suites and helpers, mirroring src/modules/
```

Modules: `auth` (OTP login, access/refresh tokens), `catalogue` (public
service categories/cities), `providers` (profiles, category applications,
review), `bookings` (the booking state machine, matching dispatch),
`matching` (candidate ranking), `realtime` (Socket.IO live location),
`payments` (checkout, webhook, refunds, payouts), `reviews`, `notifications`
(push via FCM), `admin` (the separate cookie-authenticated admin API),
`sms` (OTP delivery), `health`.

Modules own their routes and logic and are wired together in `app.ts` by
dependency injection — a module never reaches into another module's
internals directly; cross-module calls go through a narrow function
interface passed in at construction (see any module's `*Deps` type).

There is **no background job scheduler** anywhere in this codebase. Two
consequences: matching/offer expiry is settled lazily, at the start of
whichever request next touches a booking (see `bookings.service.ts`'s
`settle` function); and payouts are calculated by running
`npm run dev:payouts` (manually, or from an external cron/CI schedule) —
nothing calculates them on its own.

## API conventions

- Everything lives under `/api`.
- Errors always look like
  `{ "error": { "code": "NOT_FOUND", "message": "...", "requestId": "...", "details": [...] } }`.
  `code` is stable and machine-readable; `details` appears for validation errors.
  Unexpected errors return a generic 500 and are logged with the real cause —
  never with a stack trace or internal detail in the response body.
- Every response carries an `X-Request-Id` header, also in the logs.
- Validate input with `parseRequest(zodSchema, req)` (`src/lib/validation.ts`);
  every mutating endpoint uses an explicit allow-list schema (`z.strictObject`
  where it matters) so a client can never widen what it's allowed to set.
- See [`docs/API.md`](../docs/API.md) for the endpoint reference.

## Two authentication systems, deliberately separate

The mobile app (customers/providers) and the admin dashboard use
independent auth systems end to end — different token issuer/audience,
different secrets, different transport (Bearer header vs. HttpOnly cookie).
See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for why and how. In
short: a token minted for one can never be mistaken for the other, even if
a secret were somehow shared.

## Database

Schema changes go through Drizzle migrations, never manual edits:

1. Edit files in `src/db/schema/`.
2. `npm run db:generate -- --name=describe_the_change`
3. Read the generated SQL, then `npm run db:migrate`.

Hand-written SQL (triggers) uses `npx drizzle-kit generate --custom --name=...`.

See [`docs/DATABASE.md`](../docs/DATABASE.md) for table conventions, the
full table list, index/constraint policy, and backup/restore guidance.

In production, run migrations with a privileged role and run the API with
a least-privilege role.

## Testing

```bash
npm test
```

Covers unit, integration (real Postgres, no mocked DB), API/HTTP,
authorization (including IDOR and admin-vs-non-admin boundaries), and
concurrency tests (real `Promise.all` races against the same resource — see
`tests/bookings/concurrency.test.ts` for the double-acceptance guard, and
the `tests/payments/` and `tests/auth/` suites for payment/OTP/refresh-token
race coverage). `npm test` applies pending migrations to
`DATABASE_URL_TEST` first and truncates every table between tests.
