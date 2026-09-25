# Service Marketplace: mobile

Flutter app (Android + iOS) for the Service Marketplace platform. One
codebase with role-based customer/provider experiences: OTP phone
sign-in, browsing service categories, creating and tracking a booking
end to end (matching, provider travel with live location, service
completion), paying through PayHere, leaving/reading reviews, push
notifications, and — on the provider side — a provider profile,
category applications, availability, and live location broadcasting.
There is no admin functionality here; that's the separate
[`admin/`](../admin/README.md) web app, for internal staff only.

Features: `auth`, `booking`, `home`, `notifications`, `payments`,
`profile`, `provider`, `reviews`, `services`, `tracking` — each under
`lib/features/`, one folder per feature (see Architecture below). Test
suite: 33 files, ~478 tests (`flutter test`).

## Running

Configuration is supplied at build time with `--dart-define`; nothing is
hardcoded in Dart and **no secrets belong in these files** (anything compiled
into a mobile app can be extracted).

```bash
flutter run --dart-define-from-file=config/dev.json
flutter run --dart-define-from-file=config/staging.json
flutter build apk --dart-define-from-file=config/prod.json
```

| Key            | Meaning                                              |
| -------------- | ---------------------------------------------------- |
| `APP_ENV`      | `dev` (default), `staging` or `prod`                 |
| `API_BASE_URL` | Backend base URL. Must be `https` outside `dev`.     |

The staging/prod URLs are still `.invalid` placeholders — there is no
deployed staging or production backend yet, only a local one (see
`../server/README.md`). Point `config/staging.json`/`config/prod.json` at
real deployed URLs once those exist. A plain `flutter run` works in dev
(falls back to the emulator's host alias). An invalid configuration fails
at app start.

Windows: building Android apps that use plugins requires **Developer Mode**
(Settings, System, For developers), because Flutter needs symlink support.

## Architecture

Feature-first. Dependencies point inward: `presentation` -> `application` ->
`domain` <- `data`.

```
lib/
  app/        App shell: MaterialApp.router, go_router, theme, localization
  core/       Cross-cutting infrastructure (config, network, storage, errors)
  features/   One folder per feature, each with its own layers
    <feature>/
      presentation/   Widgets/screens. No HTTP, no storage.
      application/    Riverpod notifiers/providers (UI state, use cases)
      domain/         Plain Dart models and repository interfaces
      data/           Repository implementations, DTOs, API calls
```

Rules:

- Widgets never call the network. They watch providers.
- Providers talk to **repositories**; repositories talk to `ApiClient`
  (`core/network`). `ApiClient` returns decoded JSON and throws only
  `AppException` subtypes, so no `DioException` leaks upward.
- Dependencies are wired with Riverpod providers and can be overridden in
  tests.
- Routes, paths and access rules are declared once in
  `app/router/app_routes.dart`.

### Adding a feature screen or API call

1. `features/<x>/domain`: model + repository interface.
2. `features/<x>/data`: implementation using `ref.watch(apiClientProvider)`.
3. `features/<x>/application`: provider exposing state.
4. `features/<x>/presentation`: widget watching the provider.
5. Register the route in `app_routes.dart` and `app_router.dart`.

### Localization

English (`en`), Sinhala (`si`), Tamil (`ta`). Strings live in
`lib/app/l10n/app_*.arb`; `app_en.arb` is the template. After editing ARB
files run `flutter gen-l10n` (also runs on `flutter run`/`build`). Use
`AppLocalizations.of(context).<key>`. The Sinhala/Tamil strings are initial
examples and need review by native speakers.

### Authentication

OTP-over-SMS sign-in against the backend's `auth` module: phone number in,
a 6-digit code confirms it, the backend returns an access token (short-lived,
sent as `Authorization: Bearer` on every request via
`core/network/access_token_interceptor.dart`) and a refresh token (used to
transparently renew the access token on a 401 — see
`token_refresh_interceptor_test.dart`). A refresh-token replay is detected
server-side and revokes the whole session; the app reacts by signing the
user out (`session_manager_test.dart`). Routes carry a `RouteAccess`
(`public`, `authenticatedOnly`, `guestOnly`) that the router enforces via
`authStatusProvider`.

### Live tracking

While a booking is in a trackable stage (accepted through in-progress), the
customer sees the provider's live location over a Socket.IO connection
(`features/tracking/`). The connection badge reflects the socket's actual
state (`connecting`/`connected`/`disconnected` — labeled "Connecting…" /
"Live" / "Reconnecting…"), and the booking room is automatically rejoined
after a genuine reconnect (not just the initial connect) — see
`BookingTrackingController` in
`lib/features/tracking/application/tracking_providers.dart` and its tests
in `booking_detail_screen_test.dart`'s "live tracking" groups.

## Quality checks

```bash
dart format lib test
flutter analyze
flutter test
```
