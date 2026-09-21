import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/router/auth_redirect.dart';
import 'package:mobile/core/widgets/placeholder_screen.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';
import 'package:mobile/features/auth/presentation/auth_screen.dart';
import 'package:mobile/features/home/presentation/home_screen.dart';
import 'package:mobile/features/profile/presentation/profile_screen.dart';
import 'package:mobile/features/services/presentation/services_screen.dart';

/// The app's single [GoRouter]. All routes are declared here; access rules live
/// in [AppRoutes] and are applied by [resolveAuthRedirect].
final routerProvider = Provider<GoRouter>((ref) {
  // go_router re-evaluates `redirect` whenever this notifier changes, so a
  // sign-in or sign-out moves the user to the right place automatically.
  final authListenable = ValueNotifier<AuthStatus>(
    ref.read(authStatusProvider),
  );
  ref.listen<AuthStatus>(
    authStatusProvider,
    (_, next) => authListenable.value = next,
  );
  ref.onDispose(authListenable.dispose);

  final router = GoRouter(
    initialLocation: AppRoutes.home.path,
    refreshListenable: authListenable,
    redirect: (context, state) => resolveAuthRedirect(
      status: ref.read(authStatusProvider),
      location: state.uri.toString(),
    ),
    routes: [
      GoRoute(
        name: AppRoutes.home.name,
        path: AppRoutes.home.path,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        name: AppRoutes.auth.name,
        path: AppRoutes.auth.path,
        builder: (context, state) => const AuthScreen(),
      ),
      GoRoute(
        name: AppRoutes.services.name,
        path: AppRoutes.services.path,
        builder: (context, state) => const ServicesScreen(),
      ),
      GoRoute(
        name: AppRoutes.profile.name,
        path: AppRoutes.profile.path,
        builder: (context, state) => const ProfileScreen(),
      ),
    ],
    errorBuilder: (context, state) => PlaceholderScreen(
      title: AppLocalizations.of(context).pageNotFoundTitle,
    ),
  );
  ref.onDispose(router.dispose);
  return router;
});
