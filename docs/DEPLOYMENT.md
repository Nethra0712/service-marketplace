# Deployment

There is currently **no deployment automation in this repository** — no
Dockerfile, no CI/CD pipeline, no infrastructure-as-code, no staging or
production environment provisioned. This document describes what's
configurable and ready, and lists what's still a real blocker before this
could go to production. It reflects the state as of the Sprint 11
testing/security-hardening pass.

## Backend (`server/`)

### Environment

See `server/README.md`'s environment variable table for the full list.
Production-specific behavior already enforced by `src/config/env.ts` at
startup (the process refuses to start otherwise):

- `SMS_PROVIDER=mock`, `PAYMENT_PROVIDER=mock`, and `PUSH_PROVIDER=mock` are
  all **refused** when `NODE_ENV=production` — you cannot accidentally ship
  a build that sends no real SMS/push or processes no real payment.
- `JWT_ACCESS_SECRET`, `OTP_HMAC_SECRET`, and `ADMIN_JWT_SECRET` must all be
  distinct and at least 32 characters; the placeholder values in
  `.env.example` are explicitly rejected in production.
- `CORS_ORIGINS` must be set to the admin app's real deployed origin (or
  browser requests from it will be rejected outright — see
  `docs/ARCHITECTURE.md`). It should **not** include the mobile app, which
  doesn't need CORS at all.

### HTTPS

The backend does not terminate TLS itself — it expects to run behind a
reverse proxy / load balancer that does. `TRUST_PROXY_HOPS` must be set to
the number of proxy hops in front of it, or per-IP rate limiting (see
below) will key on the proxy's IP instead of the real client, making the
limits either useless (with an app-level default of 0, if the proxy sends a
header) or overly strict (if hops is set too high). `helmet` sets
`Strict-Transport-Security` and the rest of its default security headers
already; there's nothing further to configure on the app side once TLS is
actually terminated somewhere in front of it.

### Rate limiting

Applied per-IP (`src/middleware/ip-rate-limit.ts`) on every sensitive
route: OTP request/verify, refresh, admin login, and now the payment
webhook (added this sprint — generous, since the gateway calls from a small
pool of its own IPs). Admin login additionally has a **per-account**
lockout (10 consecutive failures locks the account 15 minutes), closing the
gap where an IP-only limit could be stepped around by rotating source IPs.

Rate-limit counters live in process memory
(`ip-rate-limit.ts`'s own doc comment). This is fine for a single instance;
**running more than one backend instance behind a load balancer makes every
limit approximate** until a shared store (Redis) replaces the in-memory
one. This is a real scaling blocker, not yet addressed.

### Logging

Pino, structured JSON, with `req.headers.authorization`, `req.headers.cookie`,
`res.headers["set-cookie"]`, and any `*.accessToken`/`*.refreshToken` field
redacted (`src/lib/logger.ts`). Health-check requests are excluded from
request logging so they don't drown real traffic. No password, OTP code, or
full JWT is ever passed to a logger call anywhere in the codebase (verified
this sprint). Set `LOG_LEVEL=info` (the default) or `warn` in production;
`debug`/`trace` are for local development only.

### Error responses

Every error response is the standard `{ error: { code, message,
requestId } }` shape; unexpected (5xx) errors return a generic message and
log the real cause server-side — a client, including an attacker probing
the API, never sees a stack trace or internal detail.

### Process management

Nothing in this repo manages the process (no systemd unit, no
Docker/Kubernetes manifest, no PM2 config). `server.ts` handles `SIGINT`/
`SIGTERM` gracefully (stops accepting new connections, lets in-flight
requests finish, closes the database pool, 10-second forced-exit timeout),
so whatever *does* supervise it (systemd, a container orchestrator, PM2)
can rely on a clean shutdown signal — that part just needs to be built.

### Known production blockers (backend)

1. **No automated database backups.** See `docs/DATABASE.md`.
2. **PayHere's real Refund API isn't implemented** — `refund()` always
   rejects with a clear error; refunds currently only work against the mock
   provider. See `docs/INCIDENT_RESPONSE.md`.
3. **Rate limiting doesn't survive multiple instances** (in-memory only —
   see above).
4. **No CI pipeline** — `npm run typecheck && npm run lint && npm test`
   (and the equivalents in `admin/` and `mobile/`) are run manually today;
   nothing blocks a broken build from being deployed.
5. **No monitoring/alerting** configured (no APM, no uptime check, no
   alert on a spike in 5xx or failed payments).

## Admin (`admin/`)

- `NEXT_PUBLIC_API_BASE_URL` must point at the real deployed backend.
- Standard `next build && next start`, or deploy to any Next.js-compatible
  host. No server-side secrets exist in this app to manage (see
  `admin/README.md`) — the only real deployment concern is making sure the
  backend's `CORS_ORIGINS` includes wherever this ends up hosted, and that
  it's served over HTTPS (the session cookie is `Secure` outside
  development, so it will not be sent at all over plain HTTP once deployed
  — verify this before assuming a broken deployment is a backend bug).

## Mobile (`mobile/`)

### Configuration

Backend URLs are supplied at build time via `--dart-define-from-file`
(`config/staging.json`, `config/prod.json`) — see `mobile/README.md`. Both
are still `.invalid` placeholders; point them at the real deployed backend
before building for either environment. A non-`dev` build with a non-HTTPS
`API_BASE_URL` fails at app start by design.

### Android release build — not production-ready yet

Verified this sprint: `flutter build apk --debug` succeeds. A **release**
build has two blockers still in the default Flutter scaffold, neither
addressed yet:

1. **`applicationId` is still `com.example.mobile`**
   (`android/app/build.gradle.kts`) — a placeholder, not a real reverse-domain
   identifier. Must be changed before any Play Store submission.
2. **The release build type signs with the debug keystore**
   (`signingConfig = signingConfigs.getByName("debug")`, same file) — a
   debug-signed APK cannot be published and offers none of the integrity
   guarantees a real release signature does. This needs a real upload
   keystore generated and kept outside version control (a `key.properties`
   file, git-ignored, read by `build.gradle.kts` — standard Flutter release
   signing setup), which is a credential-management decision for whoever
   owns the Play Console account, not something to fabricate here.

### iOS release build — not verified this sprint

This sprint ran on Windows, which cannot build or sign an iOS app (Xcode is
macOS-only). The iOS project exists (`ios/`) but a release build, code
signing, and App Store submission readiness have not been checked and need
verification on macOS with a real Apple Developer account before an iOS
release.

## Summary: what's actually blocking production

| # | Blocker | Area |
| --- | --- | --- |
| 1 | No automated database backups | Backend/ops |
| 2 | PayHere Refund API not implemented | Backend |
| 3 | Rate limiting is single-instance only | Backend/ops |
| 4 | No CI pipeline | All three apps |
| 5 | No monitoring/alerting | Backend/ops |
| 6 | Android `applicationId` is a placeholder | Mobile |
| 7 | Android release build is debug-signed | Mobile |
| 8 | iOS release build unverified | Mobile |
| 9 | No staging/production backend actually deployed yet | All three apps |

None of these are code-correctness issues — the application logic itself
(auth, bookings, payments, matching, admin) is thoroughly tested and was
security-audited this sprint (see the Sprint 11 report). These are
operational/release-engineering gaps that come before a first real
deployment, not defects in what's already built.
