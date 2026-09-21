import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';

/// Decides whether navigating to [location] must be redirected, given the
/// current [status]. Returns the path to redirect to, or null to proceed.
///
/// Pure function so the access rules can be unit-tested without a router.
String? resolveAuthRedirect({
  required AuthStatus status,
  required String location,
  Iterable<AppRoute> routes = AppRoutes.all,
}) {
  final route = _match(routes, location);
  if (route == null) return null;

  final signedIn = status == AuthStatus.authenticated;
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
