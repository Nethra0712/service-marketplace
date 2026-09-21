/// Who may open a route.
enum RouteAccess {
  /// Anyone.
  public,

  /// Signed-in users only; signed-out users are sent to the auth route.
  authenticatedOnly,

  /// Signed-out users only (e.g. the sign-in screen); signed-in users are sent
  /// home.
  guestOnly,
}

/// A named, typed route definition. The single source of truth for paths and
/// access rules; widgets navigate with these, never with string literals.
class AppRoute {
  const AppRoute({
    required this.name,
    required this.path,
    this.access = RouteAccess.public,
  });

  final String name;
  final String path;
  final RouteAccess access;
}

abstract final class AppRoutes {
  static const home = AppRoute(name: 'home', path: '/');

  static const auth = AppRoute(
    name: 'auth',
    path: '/auth',
    access: RouteAccess.guestOnly,
  );

  // Which routes require sign-in is a product decision that has not been made.
  // Until then everything except /auth is public. When it is decided, change
  // `access` here; the redirect logic already handles it.
  static const services = AppRoute(name: 'services', path: '/services');
  static const profile = AppRoute(name: 'profile', path: '/profile');

  static const all = [home, auth, services, profile];
}
