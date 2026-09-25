# Service Marketplace

An on-demand home-services marketplace for Sri Lanka: customers request a
service (cleaning, plumbing, electrical, carpentry, painting), the platform
matches and dispatches a nearby approved provider, the provider travels to
and completes the job, the customer pays through PayHere, the platform takes
a commission, and providers are paid out on a period basis. An internal
admin dashboard gives staff visibility and moderation controls over all of
it, with every sensitive action audit-logged.

Three independent codebases, no monorepo tooling (no shared build, no
workspace root `node_modules`):

| Directory | What it is | Stack |
| --- | --- | --- |
| [`server/`](server/README.md) | The backend API. Everything else talks to this; nothing talks to a database directly except this. | Node.js, TypeScript, Express 5, PostgreSQL, Drizzle ORM |
| [`mobile/`](mobile/README.md) | The customer/provider app. One codebase, role-based experience. | Flutter (Android + iOS) |
| [`admin/`](admin/README.md) | The internal staff dashboard. A thin client — see its README for why. | Next.js, TypeScript, Tailwind |

Further reading:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the pieces fit together, the two separate auth systems, realtime tracking, the booking state machine.
- [`docs/API.md`](docs/API.md) — endpoint reference by module.
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema conventions, key tables, migration workflow, backup/restore.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production configuration and what's still missing for a real production deployment.
- [`docs/INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md) — what to do when something breaks: session revocation, refund reconciliation, rollback.

## Quick start (local development)

Each app has its own setup instructions in its own README. The short version:

```bash
# 1. Backend
cd server
npm install
cp .env.example .env   # edit: set a real DB password and generate the three secrets
createdb service_marketplace
createdb service_marketplace_test
npm run db:migrate
npm run db:seed        # optional example data
npm run admin:create -- you@example.com "a-strong-password" "Your Name"
npm run dev             # http://localhost:3000

# 2. Admin dashboard (separate terminal)
cd admin
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:3000" > .env.local
npm run dev -- -p 3001  # http://localhost:3001 — set server/.env's CORS_ORIGINS to include this

# 3. Mobile app (separate terminal)
cd mobile
flutter pub get
flutter run --dart-define-from-file=config/dev.json
```

## Where things stand

Sprints 1–10 (foundation through the admin dashboard) are feature-complete.
Sprint 11 is testing, security hardening, and production-readiness work —
see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the current list of
production blockers (most notably: PayHere's real Refund API isn't wired up
yet, and there is no automated database backup in place).
