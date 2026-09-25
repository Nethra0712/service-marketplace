# Service Marketplace: admin

The internal staff dashboard: provider approval, service category
management, booking/payment/payout visibility, review moderation, user
suspension, and an audit log of every sensitive action. A separate web
application from the [backend](../server/README.md) and the
[mobile app](../mobile/README.md) — see
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for why it's split out
this way.

Stack: Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind
CSS 4, Vitest + React Testing Library.

## The one thing to understand before touching this app

**This app is never a source of authorization.** Every admin action is
independently checked by the backend (`server/src/modules/admin`) on every
request, regardless of anything this app does or doesn't render. If you're
tempted to add a client-side permission check "to be safe," that's a sign
the check belongs in the backend instead — see
`server/src/modules/admin/require-admin-auth.ts`'s own doc comment.

A consequence of this: there is **no Next.js `middleware.ts`** for auth
gating. The admin session is an HttpOnly cookie scoped to the _backend's_
origin (`/api/admin`), which Next.js's own server code — including
middleware — cannot read at all, since it runs on a different origin (see
`lib/api-client.ts`'s doc comment). Auth-gating the UI (redirecting to
`/login`, showing the right screen) is therefore done client-side, in
`app/(dashboard)/layout.tsx` — purely for UX, never for security.

## First-time setup

The backend must already be running (see `../server/README.md`) with at
least one admin account created (`npm run admin:create` there) and its
`CORS_ORIGINS` including this app's URL.

```bash
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:3000" > .env.local
npm run dev -- -p 3001   # any port other than the backend's; :3001 by convention here
```

Open `http://localhost:3001/login`.

## Environment variables

| Variable                   | Required | Default                 | Notes                                                                                                                                                                                                                                                                        |
| -------------------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | no       | `http://localhost:3000` | The backend's origin. Every request from this app goes straight to it with `credentials: 'include'` — there is no server-side proxy, so the Next.js server itself never sees or needs the admin's session. Must be set to the real backend URL in any non-local environment. |

Nothing else is configurable by design: there are no secrets in this app at
all (it holds no credentials of its own — the session lives entirely in the
backend-scoped cookie), so there is nothing else that would need to be kept
out of the client bundle.

## Scripts

| Script                 | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Run with hot reload                                         |
| `npm run build`        | Production build                                            |
| `npm start`            | Run the production build                                    |
| `npm run typecheck`    | TypeScript strict check                                     |
| `npm run lint`         | ESLint (Next.js config)                                     |
| `npm run format:check` | Prettier check (`npm run format` to fix)                    |
| `npm test`             | Vitest — API client, the `useApi` hook, login form behavior |

## Layout

```
admin/
  app/
    login/            Public login page
    (dashboard)/       Route group with the auth-gated shell (sidebar, top bar)
      page.tsx          Dashboard (operational metrics)
      providers/        Provider list, detail, approve/reject/suspend
      categories/       Service category CRUD
      bookings/         Booking search + detail (read-only)
      payments/         Payment search + detail + refund
      payouts/          Payout list, calculate, mark-paid
      reviews/          Review list + hide (never edits rating/comment)
      users/             User search + detail + suspend/reactivate
      audit-log/         The audit trail (read-only — see below)
  components/
    layout/            Sidebar, top bar
    ui/                Small Tailwind-based primitives (button, card, table, badge, states) — no external component library
  lib/
    api-client.ts       The only thing that talks to the backend
    auth-context.tsx     Client-side "am I signed in" state, for UX only (see above)
    use-api.ts           A small data-fetching hook (loading/error/success + reload)
    format.ts            Money/date formatting
  tests/               Vitest + React Testing Library
```

## No business logic here

Every decision — who can approve a provider, how commission is computed,
whether a refund is allowed, what counts as a valid category, the audit
log entries themselves — is made and enforced server-side. This app calls
the backend's admin API and renders what comes back; it does not duplicate
any of that logic, and if you find yourself writing a validation rule or a
permission check here that isn't just mirroring a message the backend
already sends back, stop and put it in `server/src/modules/admin` instead.

The audit log in particular has no create/update/delete route anywhere in
this app or the backend it talks to except the automatic writes the backend
makes on a sensitive action — "not editable by normal admins" is enforced
by that capability simply not existing, not by a permission check that
could be bypassed.

## Testing

```bash
npm test
```

For UI changes, also actually run the app (`npm run dev`) and exercise the
feature in a browser — Vitest here covers the API client and a couple of
component-level behaviors, not full page interactivity.
