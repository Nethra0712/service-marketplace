import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';

/// Decides whether navigating to [location] must be redirected, given the
/// current [status]. Returns the path to redirect to, or null to proceed.
///
/// While the status is still [AuthStatus.unknown] (a stored session is being
/// restored) every route waits on the splash screen, so a signed-in person is
/// never flashed the sign-in screen and a signed-out person never sees a
/// protected screen. Once it is known the splash forwards to the right place.
///
/// Pure function so the access rules can be unit-tested without a router.
String? resolveAuthRedirect({
  required AuthStatus status,
  required String location,
  Iterable<AppRoute> routes = AppRoutes.all,
}) {
  final route = _match(routes, location);
  final onSplash = route?.path == AppRoutes.splash.path;

  if (status == AuthStatus.unknown) {
    return onSplash ? null : AppRoutes.splash.path;
  }

  final signedIn = status == AuthStatus.authenticated;
  if (onSplash) {
    return signedIn ? AppRoutes.home.path : AppRoutes.auth.path;
  }
  if (route == null) return null;

  switch (route.access) {
    case RouteAccess.public:
      return null;
    case RouteAccess.authenticatedOnly:
      return signedIn ? null : AppRoutes.auth.path;
    case RouteAccess.guestOnly:
      return signedIn ? AppRoutes.home.path : null;
  }
}

AppRoute? _match(Iterable<AppRoute> routes, String location) {
  final path = Uri.parse(location).path;
  for (final route in routes) {
    if (route.path == path) return route;
  }
  return null;
}
