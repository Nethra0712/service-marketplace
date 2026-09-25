# Architecture

## The three applications

```
                         ┌─────────────────────┐
  Bearer token           │                      │   HttpOnly cookie session
  ┌─────────────────────▶│      server/         │◀─────────────────────┐
  │                      │   Express + Postgres  │                      │
  │                      │                      │                      │
  │  ┌───────────────────┤  /api/*  (mobile)     │                      │
  │  │  Socket.IO         │  /api/admin/* (admin) │                      │
  │  │  (live location)   └──────────┬───────────┘                      │
  │  │                               │                                  │
┌─┴──┴───┐                    (Postgres, owned                   ┌──────┴──────┐
│ mobile/ │                    exclusively by server/)             │   admin/     │
│ Flutter │                                                        │   Next.js    │
└─────────┘                                                        └─────────────┘
```

- **`server/`** is the only thing that ever talks to PostgreSQL. Neither
  client app has a database connection or credential of its own.
- **`mobile/`** is the customer/provider app. It authenticates with a
  Bearer access token (plus a refresh token) and additionally opens a
  Socket.IO connection, authenticated with the same access token, for live
  location during a booking.
- **`admin/`** is a separate, thin, staff-only Next.js app. It authenticates
  with an HttpOnly session cookie completely independent of the mobile
  app's tokens (see below) and talks to `/api/admin/*` only.

## Two authentication systems, on purpose

| | Mobile (`/api/*`) | Admin (`/api/admin/*`) |
| --- | --- | --- |
| Credential | Phone number + OTP | Email + password |
| Token transport | `Authorization: Bearer` header | HttpOnly, `SameSite=Strict` cookie, scoped to `/api/admin` |
| Token lifetime model | Short-lived access token + long-lived, rotating refresh token | Single session token, ~1 week, re-checked against the DB on every request |
| JWT issuer/audience | `service-marketplace-api` / `service-marketplace-app` | `service-marketplace-admin-api` / `service-marketplace-admin-app` |
| Signing secret | `JWT_ACCESS_SECRET` | `ADMIN_JWT_SECRET` (validated at startup to differ from the other two secrets) |
| CSRF protection | Not applicable — a token in a header is never auto-attached by a browser | Double-submit cookie, required on every mutating request |
| Session revocation | `auth_sessions` table, checked on refresh; a replayed (already-used) refresh token revokes the whole session | `admin_sessions` table, checked on **every** request, so a logout or an admin being suspended takes effect immediately, not just at next refresh |
| Can create an account via HTTP? | Yes — OTP self-registration | **No.** Only `npm run admin:create` (a CLI script) can create an admin row. |

These are not two configurations of one system — they are two independent
implementations (`src/modules/auth/` and `src/modules/admin/`) that happen
to follow the same shape (DB-backed, revocable sessions). Even if the two
JWT secrets were ever accidentally set to the same value, the different
issuer/audience pinning means a token minted for one could never be
accepted as the other.

The admin app's session cookie is scoped to the **backend's** origin, not
the admin app's own origin. This means Next.js's own server code
(including a hypothetical `middleware.ts`) can never see or check it —
cross-origin cookie isolation is a browser-enforced boundary. Auth-gating
in the admin UI is therefore client-side (`admin/app/(dashboard)/layout.tsx`),
for UX only; the backend is what actually decides authorization, on every
request, regardless of what the UI does. See `admin/README.md`.

## The booking lifecycle

```
searching ──accept──▶ accepted ──en-route──▶ en_route ──arrive──▶ arrived
    │                     │                                            │
    │                  release                                        │
    │                     │                                       start
    │◀────────────────────┘                                            │
    │                                                                  ▼
 expire (no provider found          cancel (customer,      in_progress ──complete──▶ completed
  in time) / cancel                  while cancellable)          │
    │                                    │                     cancel
    ▼                                    ▼                  (customer, until
 expired                             cancelled                work starts)
```

- **`searching`** — matching dispatches "waves" of offers to nearby,
  eligible, online providers (`src/modules/matching/`). A wave that gets no
  acceptance within its response window expires and the next wave dispatches.
  A booking that finds nobody within its overall matching window expires.
- There is **no scheduler**. Expiry and the next dispatch wave are settled
  lazily — at the start of whichever request next touches that booking
  (`bookings.service.ts`'s `settle` function) — not by a cron job.
- **Accepting is a race, guarded at the database level.** When a booking is
  offered to several providers in a wave, "accept" is a conditional
  `UPDATE ... WHERE status = 'searching'`, backed by a unique index that
  allows only one `accepted` offer per booking. Two simultaneous accept
  requests can't both win — this is covered by real concurrent-request
  tests in `tests/bookings/concurrency.test.ts`, not just sequential ones.
- **`release`** (provider backs out after accepting) returns the booking to
  `searching` and re-dispatches immediately, excluding the releasing
  provider. It is deliberately not called "provider cancellation" in the
  code or schema — the releasing provider keeps no cancellation record,
  unlike a customer cancellation, which does.
- Pricing is always resolved server-side at the relevant step: `fixed` uses
  the category's stored base rate; `hourly` is computed from server-clock
  `workStartedAt`→completion; `quote` uses the specific quote the customer
  accepted (the provider's own bid, never the customer's input). A client
  never supplies a price.

## Live location tracking

A Socket.IO connection, authenticated with the same access token REST calls
use. Each booking gets its own room (`booking:<id>`); only that booking's
customer or currently-assigned provider may join it, and only that
provider may publish updates into it (`src/modules/realtime/`).

- The server holds **no history** — only the single most recent location
  per booking, in memory, never written to a database table. This is the
  main lever behind the location-privacy requirements: there is nothing to
  retain, so there is nothing to expire or purge.
- Room authorization is re-checked against the booking's **live** database
  status on every join attempt — a booking that's no longer in a trackable
  stage is unjoinable by anyone, even someone who was legitimately in the
  room a moment before completion.
- On the mobile side, a socket reconnect (after a network blip) is a
  brand-new underlying connection — the server has forgotten the room
  membership even though the UI's connection badge goes back to "Live".
  `BookingTrackingController` (`mobile/lib/features/tracking/application/tracking_providers.dart`)
  detects a genuine reconnect (a `disconnected` state, however many
  `connecting` retries it takes, followed by `connected`) and rejoins the
  room automatically; it does not rejoin on the very first connect, which
  is already handled by the initial join.

## Payments, commission, and payouts

```
booking completed
      │
      ▼
payment row created (status: pending) ── customer starts checkout ──▶ PayHere hosted page
      │                                                                       │
      │                                                            gateway callback (webhook)
      │                                                                       │
      ▼                                                                       ▼
  serviceAmount = booking.agreedAmount                          signature verified, amount
  commissionAmount = round(serviceAmount × PLATFORM_COMMISSION_BASIS_POINTS)   cross-checked against
  providerEarningAmount = serviceAmount − commissionAmount        the server's own stored amount
                                                                               │
                                                                   status → succeeded/failed/cancelled
                                                                   (idempotent: a duplicate callback,
                                                                    or one that loses a race to another,
                                                                    is logged and never re-applied)
```

- Commission is **always** computed server-side from
  `PLATFORM_COMMISSION_BASIS_POINTS`; nothing accepts a commission or price
  figure from a client anywhere in the codebase.
- Rounding: commission is `round(serviceCents × bps / 10000)` in integer
  cents; provider earning is `serviceCents − commissionCents`, never
  independently rounded — this guarantees the two always sum exactly to the
  service amount, with any rounding remainder landing with the provider.
- A payment can only be refunded from `succeeded`, only once, and never
  after it's been swept into a payout (reconciling money already paid out
  is out of scope for this version — see `docs/INCIDENT_RESPONSE.md`).
  PayHere's real Refund API isn't wired up yet (`PayHereProvider.refund`
  always rejects — see its own doc comment); refunds only work through the
  mock provider today.
- Payouts are calculated per provider per period (`npm run dev:payouts`,
  manually or via an external schedule — no cron exists in this codebase),
  idempotent per `(providerProfileId, periodStart, periodEnd)`: recomputing
  an already-calculated period returns the same row, unchanged. Marking a
  payout paid is a manual, out-of-band step (the actual bank transfer
  happens outside this system) that just records that it happened.

## The admin module

`src/modules/admin/` is deliberately not a set of extra checks bolted onto
the customer/provider routes — it's a separate router tree
(`/api/admin/*`), mounted with its own auth/CSRF middleware, that mostly
*reuses* existing service logic (e.g. provider review, payment refunds, and
payout calculation are the same service functions the rest of the backend
already had — the admin routes just add authorization, listing/search, and
an audit-log entry around them) rather than reimplementing it.

Every sensitive admin action (provider approval/suspension, user
suspension, category changes, refunds, payout mark-paid, review hiding)
writes one row to `admin_audit_log`. That table has no update or delete
route anywhere, in either the backend or the admin app — "not editable by
normal admins" is enforced by that capability not existing, not by a
permission check that could be bypassed.

## Module boundaries (backend)

Each folder under `src/modules/` owns its own routes, service logic, and
(where it has one) repository. A module is wired into `app.ts` by
dependency injection — passed the specific functions it needs from other
modules (e.g. bookings receives `findProviderProfileId` from the providers
module) rather than importing another module's internals directly. This
keeps the dependency graph explicit and lets every module's tests construct
it with fakes instead of the whole app.
