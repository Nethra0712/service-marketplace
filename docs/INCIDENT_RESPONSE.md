# Incident response and recovery notes

Practical notes for the specific failure modes this system can hit, what
they look like, and what to actually do about them. Not a general
on-call handbook — just what's true of *this* codebase.

## Revoking access

### A compromised or off-boarded admin account

Admin accounts aren't `users` rows, so the dashboard's own **Users →
suspend** action doesn't apply to them, and there is no HTTP endpoint that
disables an admin account (consistent with there being no HTTP endpoint
that creates one either — see `admin/README.md`). This is a manual
database operation:

```sql
-- Revokes every active session for this admin right now — checkSession
-- checks the DB on every single request, so this takes effect on their very
-- next request, not at next token expiry.
UPDATE admin_sessions SET revoked_at = now()
WHERE admin_user_id = (SELECT id FROM admin_users WHERE email = 'them@example.com')
  AND revoked_at IS NULL;

-- To also stop them logging back in, lock the account far into the future:
UPDATE admin_users SET locked_until = now() + interval '100 years'
WHERE email = 'them@example.com';
```

There is currently no `npm run` script for this — the above is a manual DB
operation. (A proper `admin:disable` CLI script, mirroring
`admin:create`, would be a reasonable follow-up if this becomes routine.)

### A compromised customer/provider account, or a suspicious session

The admin dashboard's **Users → suspend** action
(`POST /api/admin/users/:id/suspend`) sets `status = 'suspended'` and is
enough on its own: `requireAuth`'s `checkSession` re-checks `users.status`
against the database on **every single authenticated request**, not just at
token expiry, so a still-valid access token stops working on its very next
use — and `refresh()` independently checks the same thing, so a still-valid
refresh token can't mint a new access token for a suspended account either
(`session.service.ts`, both checks). No further action is needed for the
normal case. For a scenario where you also want their session rows
revoked outright (e.g. before reactivating them later, so an old token
can't resurface):

```sql
UPDATE auth_sessions SET revoked_at = now(), revoked_reason = 'security_incident'
WHERE user_id = (SELECT id FROM users WHERE phone_e164 = '+94771234567')
  AND revoked_at IS NULL;
```

### A leaked JWT secret

Rotating `JWT_ACCESS_SECRET`, `OTP_HMAC_SECRET`, or `ADMIN_JWT_SECRET`
signs out **everyone** of that kind immediately (every existing token fails
signature verification on its next use) — see `.env.example`'s own comment
on each. This is disruptive but is the correct response to a real secret
leak; there's no partial-rotation mechanism. After rotating, every active
user/provider/admin has to sign in again.

## Payment incidents

### A payment appears stuck in `pending`

Check `payment_ledger_entries` for that payment id first — if there's no
`succeeded`/`failed`/`cancelled` entry, the gateway callback was never
received (network issue on the gateway's side, or a firewall/routing
problem on ours) rather than something the app got wrong. PayHere's
dashboard is the source of truth for whether the payment actually
succeeded on their end; this system has no way to *poll* PayHere for a
payment's status, only to receive its callback. Until a reconciliation job
exists, a genuinely stuck payment needs to be checked manually against the
PayHere dashboard and the outcome applied by hand if the callback is
confirmed lost.

### A refund needs to happen, and it's more than a mock-provider test

**PayHere's real Refund API is not implemented** — `PayHereProvider.refund`
unconditionally rejects (`server/src/modules/payments/payhere-payment-provider.ts`).
The admin dashboard's refund button will work end-to-end in any environment
still running the mock payment provider, and will visibly fail with a clear
error against a real PayHere-backed deployment. Until that integration is
built, a real refund has to be issued directly through the PayHere merchant
dashboard, and then the payment's local record reconciled by hand (there is
no admin action for "record a refund that happened out-of-band" yet — the
existing `refund` action always tries to call the gateway itself).

### Suspected double-refund or double-payout

Both are guarded by database-level idempotency (unique constraints /
conditional updates — see `docs/DATABASE.md` and `docs/ARCHITECTURE.md`),
so a double-refund or double-payout from the *application* racing itself
should not be possible. If one is observed anyway:

1. Pull every row from `payment_ledger_entries` for the payment (or every
   payout row for the provider/period) — it's an append-only audit trail,
   so the full history of what actually happened is there.
2. Check whether it happened at the **gateway** level instead (e.g. the
   process crashed between a successful PayHere refund call and the local
   DB write confirming it, and a retry then called PayHere a second time —
   this specific window is a documented, currently-unmitigated risk since
   real refunds aren't wired up yet; see the code comment on
   `refundPayment` in `payments.service.ts`). That's a PayHere-side
   reconciliation, not a database bug.

## Reliability

### Backend restart

Graceful shutdown is implemented (`server.ts`): `SIGTERM`/`SIGINT` stop
new connections, let in-flight requests finish, close the DB pool, with a
10-second forced-exit fallback. On restart, in-flight financial writes that
were correctly wrapped in a DB transaction either fully committed or fully
rolled back — nothing is left half-applied there. What a restart *can*
still leave inconsistent (documented, low-severity, audit-trail-only gaps —
see the code comments on `createPaymentRow` and the success path of
`handleCallback` in `payments.service.ts`) is a payment whose state
transition landed but whose ledger entry didn't, if the process died in the
exact instant between the two statements of an otherwise-transactional
pair. This does not affect money movement or idempotency, only the
completeness of the audit trail for that one event.

### Database reconnect

`server.ts` pings the database at startup and logs (not crashes) if it's
unreachable; `/api/health/db` reflects live reachability so a load balancer
or monitor can react. The `pg` connection pool itself handles transient
reconnects for individual queries.

### WebSocket reconnect

Socket.IO's client has reconnection built in and enabled
(`mobile/lib/features/tracking/data/socket_io_tracking_socket.dart`). As of
this sprint, a genuine reconnect (not the initial connect) now also
**rejoins the booking room automatically** — before this fix, the
connection badge would report "Live" again after a network blip while
location updates silently stayed dark, because room membership lives on
the socket connection itself and a reconnect is a brand-new connection
server-side. See `docs/ARCHITECTURE.md` and
`BookingTrackingController` in `tracking_providers.dart`.

## Restoring from a database backup

See `docs/DATABASE.md`'s Backup and Restore section for the commands.
Notes specific to *this* schema when restoring:

- Restore to a **new, empty database**, verify it, then cut over — never
  `pg_restore` over a live database.
- After restoring, check `admin_sessions` and `auth_sessions` for rows
  that were revoked *after* the backup was taken but whose revocation
  wouldn't be in an older backup — a restore from before a security
  incident's containment (see "Revoking access" above) will bring back
  sessions you already revoked. Re-run the relevant revocation queries
  after any restore that predates one.
- `payments`/`payment_ledger_entries`/`provider_payouts` are the tables
  where a restore to a stale backup has real financial consequences (a
  payment that succeeded after the backup was taken would appear
  `pending` again, and a naive retry could double-process it if the
  gateway is also replayed) — reconcile against PayHere's own dashboard
  for the gap window before trusting the restored payment state.

## Rollback (application code)

There is no automated deployment/rollback mechanism (see
`docs/DEPLOYMENT.md`). A code rollback today means redeploying a previous
build/commit by hand. Two things to check specifically when rolling back:

1. **Did the version you're rolling back to predate a database migration
   that's already applied?** Migrations in this codebase are additive
   (new tables/columns), not destructive, so an older server version
   generally still runs against a newer schema — but verify this for
   whatever specific migration range you're crossing before assuming it's
   safe.
2. **Admin session/JWT compatibility** — rolling back does not change the
   configured secrets, so existing sessions remain valid across a rollback
   as long as the secrets themselves haven't also changed.
