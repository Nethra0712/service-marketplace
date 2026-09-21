# Service Marketplace: mobile

Flutter app (Android + iOS) for the Service Marketplace platform. One codebase
with role-based customer/provider experiences (roles are not implemented yet).

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

The staging/prod URLs are `.invalid` placeholders until the backend exists.
A plain `flutter run` works in dev (falls back to the emulator's host alias).
An invalid configuration fails at app start.

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

### Authentication (not implemented)

`authStatusProvider` currently always reports signed-out, and routes carry a
`RouteAccess` (`public`, `authenticatedOnly`, `guestOnly`) that the router
already enforces. `accessTokenReaderProvider` is the seam where the auth
feature will supply tokens to Dio.

## Quality checks

```bash
dart format lib test
flutter analyze
flutter test
```
