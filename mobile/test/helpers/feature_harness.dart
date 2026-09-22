import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/data/session_store.dart';
import 'package:mobile/features/provider/application/provider_providers.dart';
import 'package:mobile/features/services/application/catalogue_providers.dart';

import 'catalogue_fakes.dart';
import 'fakes.dart';
import 'pump_app.dart';

/// The whole app on fake auth, a fake catalogue and a fake provider backend.
class FeatureHarness {
  FeatureHarness({
    FakeCatalogueRepository? catalogue,
    FakeProviderRepository? provider,
    this.signedIn = true,
  }) : catalogue = catalogue ?? FakeCatalogueRepository(),
       provider = provider ?? FakeProviderRepository() {
    auth = AuthHarness(
      extraOverrides: [
        catalogueRepositoryProvider.overrideWithValue(this.catalogue),
        providerRepositoryProvider.overrideWithValue(this.provider),
      ],
    );
  }

  final FakeCatalogueRepository catalogue;
  final FakeProviderRepository provider;
  final bool signedIn;
  late final AuthHarness auth;

  ProviderContainer get container => auth.container;

  /// Starts the app (signed in from a stored session, unless [signedIn] is
  /// false) and optionally pushes [location] on top of home.
  Future<void> open(WidgetTester tester, [String? location]) async {
    if (signedIn) {
      await SessionStore(auth.storage).write(makeSession(auth.clock.now));
    }
    await pumpApp(tester, auth);
    if (location != null) {
      // ignore: unawaited_futures
      routerOf(auth).push(location);
      await settle(tester);
    }
  }

  void dispose() => auth.dispose();
}
