# API reference

Base path for everything: `/api`. All request/response bodies are JSON
unless noted. Errors always look like:

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "requestId": "...", "details": [] } }
```

`code` is stable and machine-readable (switch on it, not on `message`).
`details` (an array of `{ path, message }`) appears only for validation
errors. Every response carries an `X-Request-Id` header.

**Auth column key:** `public` = no auth. `mobile` = `Authorization: Bearer
<access token>`. `admin` = admin session cookie + `X-CSRF-Token` header on
mutating requests (see `admin/README.md`).

This is a reference of what exists and who may call it — for exact request
bodies and validation rules, read the Zod schema next to each router
(`*.schemas.ts` beside each `*.routes.ts`), which is the actual source of
truth and is what the server enforces.

## Health — `/api/health` (public)

| Method | Path | |
| --- | --- | --- |
| GET | `/api/health` | Process is up |
| GET | `/api/health/db` | Can reach PostgreSQL |

## Auth — `/api/auth`

OTP phone sign-in. Rate-limited on every route (see `docs/DEPLOYMENT.md`).

| Method | Path | Auth | |
| --- | --- | --- | --- |
| POST | `/otp/request` | public | Send a 6-digit code by SMS to a phone number |
| POST | `/otp/verify` | public | Verify the code → access token + refresh token; creates the account on first success |
| POST | `/refresh` | public (refresh token in body) | Rotate the refresh token, mint a new access token. Reusing an already-used refresh token revokes the whole session. |
| POST | `/logout` | public (refresh token in body) | Revokes the session |
| GET | `/me` | mobile | The caller's own user id/phone/status |

## Catalogue — `/api` (public, read-only)

| Method | Path | |
| --- | --- | --- |
| GET | `/cities` | Active cities |
| GET | `/service-categories` | Active categories, optionally filtered by city |
| GET | `/service-categories/:slug` | One category's detail |

## Provider self-service — `/api/provider` (mobile, provider role implied by ownership)

| Method | Path | |
| --- | --- | --- |
| GET | `/profile` | The caller's own provider profile |
| PUT | `/profile` | Create/update it (never accepts `verificationStatus` — server-only) |
| POST | `/profile/submit` | Submit for verification |
| PUT | `/profile/availability` | Online/offline toggle |
| PUT | `/profile/location` | Current coordinates (for matching's distance ranking) |
| GET | `/services` | The caller's category applications |
| POST | `/services` | Apply for a category in a city |
| GET | `/services/:id` | One application's detail |
| POST | `/services/:id/resubmit` | Resubmit a rejected application |
| DELETE | `/services/:id` | Withdraw a pending application |

## Bookings — `/api/bookings` (mobile)

Every write is authorized against the caller (never a supplied user id);
an id that exists but isn't the caller's looks exactly like a 404. See
`docs/ARCHITECTURE.md` for the state machine.

| Method | Path | |
| --- | --- | --- |
| POST | `/` | Create a booking (customer) |
| GET | `/mine` | The caller's bookings as customer |
| GET | `/assigned` | The caller's bookings as assigned provider |
| GET | `/open` | Bookings currently offered to the caller (provider) |
| GET | `/:id` | One booking's detail (customer, assigned provider, or a provider who holds/held an offer on it) |
| POST | `/:id/accept` | Provider accepts an open offer — see the concurrency note in `docs/ARCHITECTURE.md` |
| POST | `/:id/decline` | Provider declines an offer |
| POST | `/:id/en-route` \| `/arrived` \| `/start` \| `/complete` | Provider's status transitions |
| POST | `/:id/release` | Assigned provider backs out; re-dispatches |
| POST | `/:id/cancel` | Customer cancels (while cancellable) |
| POST | `/:id/quotes` | Provider submits a quote (quote-priced categories only) |
| POST | `/:id/quotes/:quoteId/accept` \| `/reject` | Customer responds to a quote |
| POST | `/:id/payment/checkout` | Customer starts/resumes paying (from the payments module, mounted at the same prefix) |
| GET | `/:id/payment` | Customer or assigned provider views the current payment |
| POST | `/:id/review` | Submit a review for a completed booking (from the reviews module, mounted at the same prefix) |
| GET | `/:id/reviews` | The booking's reviews |

## Payments — `/api/payments` (public webhook only)

| Method | Path | Auth | |
| --- | --- | --- | --- |
| POST | `/webhook` | public, signature-verified | The gateway's callback. Authenticity comes from the callback's own signature (checked inside the handler), not from any session — a gateway can't present this app's tokens. Idempotent: a duplicate or race-losing callback is logged and never re-applied. |

## Reviews — `/api/reviews` (mobile)

| Method | Path | |
| --- | --- | --- |
| GET | `/providers/:providerProfileId/summary` | A provider's public rating summary (hidden reviews excluded) |

(Submitting/listing reviews for a specific booking is under `/api/bookings/:id/...` above.)

## Notifications — `/api/notifications` (mobile)

| Method | Path | |
| --- | --- | --- |
| POST | `/tokens` | Register a device push token |
| DELETE | `/tokens` | Unregister it |
| GET | `/preferences` | The caller's notification preferences |
| PUT | `/preferences` | Update them |
| GET | `/` | List the caller's notifications |
| POST | `/:id/read` | Mark one read |
| POST | `/read-all` | Mark all read |

## Admin — `/api/admin` (admin)

Everything below requires the admin session cookie; every mutation also
requires the CSRF header. See `admin/README.md` and
`docs/ARCHITECTURE.md`.

**Auth** (`/api/admin/auth`) — `/login` is the only unauthenticated route here:

| Method | Path | |
| --- | --- | --- |
| POST | `/login` | Rate-limited per IP and per account (10 failures locks the account 15 min) |
| POST | `/logout` | |
| GET | `/me` | |

**Dashboard** (`/api/admin/dashboard`)

| Method | Path | |
| --- | --- | --- |
| GET | `/` | Live operational metrics — users, providers, bookings, revenue, payouts, reviews. Nothing here is cached or pre-computed. |

**Providers** (`/api/admin/providers`)

| Method | Path | |
| --- | --- | --- |
| GET | `/` | List/search, filter by verification status |
| GET | `/:id` | Detail + category applications |
| POST | `/:id/applications/:applicationId/review` | Approve/reject/suspend an application (audit-logged) |
| POST | `/:id/profile/review` | Verify/reject a profile (audit-logged) |

**Categories** (`/api/admin/categories`)

| Method | Path | |
| --- | --- | --- |
| GET | `/` | List |
| POST | `/` | Create (audit-logged) |
| PATCH | `/:id` | Edit, including activate/deactivate and pricing (audit-logged) |

**Bookings** (`/api/admin/bookings`) — read-only

| Method | Path | |
| --- | --- | --- |
| GET | `/` | Search |
| GET | `/:id` | Full detail: state, assignment history, cancellation |

**Payments** (`/api/admin/payments`)

| Method | Path | |
| --- | --- | --- |
| GET | `/` | Search |
| GET | `/:id` | Detail + ledger |
| POST | `/:id/refund` | Refund (audit-logged; see the refund caveats in `docs/INCIDENT_RESPONSE.md`) |

**Payouts** (`/api/admin/payouts`)

| Method | Path | |
| --- | --- | --- |
| GET | `/` | List |
| GET | `/providers/:providerProfileId` | One provider's payout history |
| POST | `/calculate` | Compute payouts for a period (idempotent; not itself audit-logged — see its own doc comment) |
| POST | `/:id/mark-paid` | Record a payout as paid (audit-logged) |

**Reviews** (`/api/admin/reviews`)

| Method | Path | |
| --- | --- | --- |
| GET | `/` | List/search, filter by hidden status |
| POST | `/:id/hide` | Hide from public ratings (audit-logged). Never edits the rating or comment. |

**Users** (`/api/admin/users`)

| Method | Path | |
| --- | --- | --- |
| GET | `/` | Search |
| GET | `/:id` | Detail |
| POST | `/:id/suspend` | Suspend (audit-logged; revokes their session immediately) |
| POST | `/:id/reactivate` | Reactivate (audit-logged) |

**Audit log** (`/api/admin/audit-log`) — read-only, on purpose (see `docs/ARCHITECTURE.md`)

| Method | Path | |
| --- | --- | --- |
| GET | `/` | Filter by action/target type |
