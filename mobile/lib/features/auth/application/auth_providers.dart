import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mobile/core/network/access_token_interceptor.dart';
import 'package:mobile/core/network/network_providers.dart';
import 'package:mobile/core/network/token_refresh_interceptor.dart';
import 'package:mobile/core/storage/secure_storage.dart';
import 'package:mobile/core/utils/clock.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/application/auth_state.dart';
import 'package:mobile/features/auth/application/session_manager.dart';
import 'package:mobile/features/auth/data/auth_api_repository.dart';
import 'package:mobile/features/auth/data/current_user_api_repository.dart';
import 'package:mobile/features/auth/data/session_store.dart';
import 'package:mobile/features/auth/domain/auth_repository.dart';
import 'package:mobile/features/auth/domain/current_user.dart';

final sessionStoreProvider = Provider<SessionStore>(
  (ref) => SessionStore(ref.watch(secureStorageProvider)),
);

/// Sign-in, refresh and sign-out calls, made without credentials.
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthApiRepository(
    ref.watch(publicApiClientProvider),
    ref.watch(clockProvider),
  ),
);

/// Reads the signed-in user. Depends on the authenticated client, which in turn
/// depends on the [SessionManager], so it must only be read lazily (never while
/// the auth controller is being built).
final currentUserRepositoryProvider = Provider<CurrentUserRepository>(
  (ref) => CurrentUserApiRepository(ref.watch(apiClientProvider)),
);

final sessionManagerProvider = Provider<SessionManager>((ref) {
  final manager = SessionManager(
    store: ref.watch(sessionStoreProvider),
    repository: ref.watch(authRepositoryProvider),
    now: ref.watch(clockProvider),
  );
  ref.onDispose(manager.dispose);
  return manager;
});

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

/// The signed-in user, or null (signed out, still loading, or offline).
final currentUserProvider = Provider<CurrentUser?>(
  (ref) => ref.watch(authControllerProvider.select((state) => state.user)),
);

/// Plugs authentication into the HTTP layer. Add these to the root
/// `ProviderScope` overrides: they replace the "no token, never refresh"
/// defaults that `core/network` ships with, without `core` ever importing a
/// feature.
final List<Override> authNetworkOverrides = [
  accessTokenReaderProvider.overrideWith(
    (ref) => ref.watch(sessionManagerProvider).readAccessToken,
  ),
  tokenRefresherProvider.overrideWith(
    (ref) => ref.watch(sessionManagerProvider).refresh,
  ),
];
