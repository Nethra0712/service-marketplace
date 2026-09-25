# Database

PostgreSQL, accessed exclusively through `server/` via Drizzle ORM. Neither
`mobile/` nor `admin/` ever connects to it directly.

## Conventions

- UUID primary keys (`defaultRandom()`).
- `created_at`/`updated_at` on every table that has them, `updated_at` kept
  current by a database trigger (not application code) — see the
  hand-written migrations for the trigger definitions.
- snake_case columns (Drizzle maps `camelCase` in TypeScript to
  `snake_case` in SQL automatically).
- Foreign keys default to `ON DELETE RESTRICT` — nothing in this schema
  silently cascades a delete; a row that's still referenced blocks the
  delete instead of quietly taking dependents with it.
- Business rules are enforced with database `CHECK` constraints wherever
  practical (not just application-level validation), e.g. `baseRate` being
  required for `fixed`/`hourly` pricing and forbidden for `quote`, or a
  review's `rating` being 1–5. Application code (Zod schemas) validates the
  same rules for a fast, well-formatted error — the database constraint is
  the actual backstop.
- Idempotency and race-safety come from unique indexes and conditional
  updates, not application-level locking. See `docs/ARCHITECTURE.md` for
  concrete examples (booking acceptance, payments, payouts).

## Tables

| Table | Purpose |
| --- | --- |
| `users` | Customers and providers are both rows here — there is no separate "customers" table. Status: `active`/`suspended`. |
| `profiles` | Display name etc., one-to-one with `users`. |
| `refresh_tokens`, `auth_sessions` | Mobile app session state. |
| `otp_challenges` | Pending phone verification codes (hashed, not stored in plaintext). |
| `cities`, `service_categories`, `service_category_translations`, `city_categories` | The public catalogue. |
| `provider_profiles` | A provider's verification state, bio, current location. |
| `provider_services` | A provider's per-category-per-city applications and their approval status. |
| `bookings` | The booking state machine — see `docs/ARCHITECTURE.md`. |
| `booking_offers` | Dispatch offers, one row per (booking, provider, wave). |
| `booking_quotes` | Provider bids on quote-priced bookings. |
| `booking_provider_releases` | History of a provider backing out of an assignment. |
| `payments`, `payment_ledger_entries` | One payment row per attempt; the ledger is an insert-only audit trail of every state transition and duplicate/ignored callback. |
| `provider_payouts` | One row per (provider, period); payments are stamped with the payout id that swept them in. |
| `reviews` | Two-sided (customer↔provider); `hidden_at`/`hidden_by_admin_id`/`hidden_reason` support admin moderation without ever touching `rating`/`comment`. |
| `device_tokens`, `notification_preferences`, `notifications` | Push notification delivery and history. |
| `admin_users` | Internal staff accounts. Includes `failed_login_attempts`/`locked_until` for the account-lockout policy — see `docs/DEPLOYMENT.md`. |
| `admin_sessions` | Admin login sessions (separate from `auth_sessions`). |
| `admin_audit_log` | Insert-only. No update/delete route exists anywhere for it — see `docs/ARCHITECTURE.md`. |

## Migration workflow

Schema changes always go through Drizzle migrations — never a manual `ALTER
TABLE` against a running database.

```bash
# 1. Edit src/db/schema/*.ts
# 2. Generate the migration
npm run db:generate -- --name=describe_the_change
# 3. Read the generated SQL in src/db/migrations/ before applying it
# 4. Apply it
npm run db:migrate
```

Hand-written migrations (the `updated_at` triggers; anything Drizzle can't
generate on its own) use `npx drizzle-kit generate --custom --name=...` and
are reviewed the same way. As of this sprint there are 19 migrations
(0000–0018).

`npm test` applies pending migrations to `DATABASE_URL_TEST` automatically
(`tests/global-setup.ts`) before the suite runs — you don't need to run
`db:migrate` against the test database by hand, only against the real one.

## Indexes and constraints

Every foreign-key column has a supporting index. Beyond that, indexes exist
specifically to back either a real query pattern or a correctness
guarantee — not speculatively. The ones enforcing correctness (not just
performance) are the important ones to know about, since they're load-bearing
for the concurrency guarantees in `docs/ARCHITECTURE.md`:

- `booking_offers_booking_accepted_uidx` — at most one `accepted` offer per
  booking, ever. This is *the* guard against two providers both winning a
  booking.
- `booking_offers_booking_provider_wave_uidx` /
  `..._pending_uidx` — a provider is offered a given booking at most once
  per wave, and holds at most one pending offer on it at a time.
- `payments_booking_active_uidx` — at most one active (non-terminal)
  payment per booking.
- `payments_external_reference_uidx` — a payment's gateway-facing reference
  is globally unique, used to look up the right row from a webhook callback.
- `provider_payouts_provider_period_uidx` — at most one payout per
  (provider, period); this is what makes recomputing a period idempotent.
- `admin_users_email_uidx`, `service_categories_slug_uidx` — the usual
  uniqueness guarantees.

## Backup and restore

**There is no automated backup configured in this repository or codebase**
— no scheduled `pg_dump`, no managed-database snapshot policy, nothing
wired into CI/CD (there is no CI/CD configured either; see
`docs/DEPLOYMENT.md`). This is a real production blocker, not an
oversight to leave undocumented. Until it's automated:

**Manual backup:**

```bash
pg_dump --format=custom --file=backup_$(date +%Y%m%d_%H%M).dump "$DATABASE_URL"
```

**Manual restore** (to a fresh, empty database — never restore over a live one):

```bash
createdb service_marketplace_restore
pg_restore --dbname=service_marketplace_restore backup_20260101_0000.dump
```

**Recommended, not yet implemented, for a real production deployment:**

- A managed Postgres provider's automated daily snapshots + point-in-time
  recovery (RDS, Cloud SQL, Neon, etc.), rather than hand-rolled `pg_dump`
  on a cron.
- A periodic *restore drill* — a backup nobody has ever restored is not a
  verified backup.
- Retention long enough to cover the financial-record audit window you
  intend to keep (`payments`, `payment_ledger_entries`, `provider_payouts`,
  `admin_audit_log` are all insert-only/append-mostly by design — see
  `docs/ARCHITECTURE.md` — so they're the highest-value tables to protect).

See `docs/INCIDENT_RESPONSE.md` for what to do if you need to actually
restore from a backup.
