# Service Marketplace: server

Backend API for the Service Marketplace platform.

Stack: Node.js, TypeScript (strict), Express 5, PostgreSQL + PostGIS,
Drizzle ORM, Zod. Pino for logging, Vitest for tests.

**Scope so far (Sprint 2):** the API foundation and the database foundation only.
There is no authentication, booking, payment, matching, real-time, or admin code
yet.

## Requirements

- Node.js 22.12 or newer
- PostgreSQL 15+ **with the PostGIS extension available** (PostGIS is enabled by
  the first migration, which needs a role that may create extensions)

## First-time setup

```bash
cd server
npm install
cp .env.example .env        # then edit .env: set the real database password
```

Create two empty databases (names are the defaults in `.env.example`):

```bash
createdb service_marketplace
createdb service_marketplace_test     # used only by the test suite
```

Apply the schema and (optionally) load development example data:

```bash
npm run db:migrate
npm run db:seed
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
variables are wrong but never their values, if any are invalid.

| Variable            | Required | Default       | Notes                                                                             |
| ------------------- | -------- | ------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`      | yes      |               | `postgres://` or `postgresql://` URL. Contains credentials, so keep it secret.    |
| `NODE_ENV`          | no       | `development` | `development`, `test` or `production`                                             |
| `PORT`              | no       | `3000`        |                                                                                   |
| `CORS_ORIGINS`      | no       | empty         | Comma-separated browser origins. Empty means no cross-origin access.              |
| `LOG_LEVEL`         | no       | `info`        | `fatal` to `trace`, or `silent`                                                   |
| `DATABASE_URL_TEST` | tests    |               | Test-only. The database name **must** end in `_test`; tests refuse anything else. |

`.env` is git-ignored. Never commit real credentials; only `.env.example`
belongs in Git.

## Scripts

| Script                 | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | Run with auto-reload                                          |
| `npm run build`        | Compile to `dist/` and copy the SQL migrations                |
| `npm start`            | Run the compiled server                                       |
| `npm run typecheck`    | TypeScript strict check (source and tests)                    |
| `npm run lint`         | ESLint (type-aware, strict)                                   |
| `npm run format:check` | Prettier check (`npm run format` to fix)                      |
| `npm test`             | Vitest. Applies migrations to the test database first         |
| `npm run db:generate`  | Generate a migration from schema changes (`drizzle-kit`)      |
| `npm run db:migrate`   | Apply pending migrations to `DATABASE_URL`                    |
| `npm run db:seed`      | Load development example data (refuses `NODE_ENV=production`) |
| `npm run dev:review`   | Dev-only: approve/reject a provider (see below)               |

### Reviewing providers (development only)

Approving, rejecting and suspending providers is a platform decision and is
deliberately **not** exposed over HTTP. Until an admin dashboard exists, use the
CLI (it refuses to run when `NODE_ENV=production`):

```bash
npm run dev:review -- +94771234567 show
npm run dev:review -- +94771234567 profile verified
npm run dev:review -- +94771234567 service plumbing approved "Certificate checked"
```

A provider is bookable only when their profile is `verified` **and** the
category application is `approved`.

## Layout

```
server/
  src/
    config/        env validation (Zod) and .env loading
    db/
      schema/      Drizzle table definitions, one file per table
      migrations/  generated SQL + hand-written SQL (PostGIS, triggers)
      seed/        development-only example data
      client.ts    pg pool + Drizzle instance, ping and shutdown helpers
    lib/           errors, logger, validation and timeout helpers
    middleware/    error handler, 404 handler
    modules/       one folder per feature area (currently just `health`)
    app.ts         builds the Express app from injected dependencies
    server.ts      process entry point: config, listen, graceful shutdown
  tests/           Vitest suites and helpers
```

Modules own their routes and logic and are wired together in `app.ts`. A module
should not reach into another module's internals.

## API conventions

- Everything lives under `/api`.
- Errors always look like
  `{ "error": { "code": "NOT_FOUND", "message": "...", "requestId": "...", "details": [...] } }`.
  `code` is stable and machine-readable; `details` appears for validation errors.
  Unexpected errors return a generic 500 and are logged with the real cause.
- Every response carries an `X-Request-Id` header, also in the logs.
- Validate input with `parseRequest(zodSchema, req)` (`src/lib/validation.ts`).

## Database

Schema changes go through Drizzle migrations, never manual edits:

1. Edit files in `src/db/schema/`.
2. `npm run db:generate -- --name=describe_the_change`
3. Read the generated SQL, then `npm run db:migrate`.

Hand-written SQL (extensions, triggers) uses `npx drizzle-kit generate --custom --name=...`.

Tables: `users`, `profiles`, `provider_profiles`, `service_categories`,
`provider_services`. Conventions: UUID primary keys, `created_at`/`updated_at`
(kept current by a database trigger), snake_case columns, foreign keys use
`ON DELETE RESTRICT`, and business rules are enforced with constraints.

In production, run migrations with a privileged role and run the API with a
least-privilege role.
