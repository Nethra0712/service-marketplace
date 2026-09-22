/// Who may open a route.
enum RouteAccess {
  /// Anyone, signed in or not.
  public,

  /// Signed-in users only; signed-out users are sent to the sign-in screen.
  authenticatedOnly,

  /// Signed-out users only (the sign-in screens); signed-in users are sent
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
  /// Shown while a stored session is being checked at launch.
  static const splash = AppRoute(name: 'splash', path: '/splash');

  // Sign-in: reachable only while signed out.
  static const auth = AppRoute(
    name: 'auth',
    path: '/auth',
    access: RouteAccess.guestOnly,
  );
  static const otp = AppRoute(
    name: 'otp',
    path: '/auth/otp',
    access: RouteAccess.guestOnly,
  );

  // The signed-in app. Everything past sign-in requires a session. (Whether
  // any screens should be browsable without an account is a product decision
  // that can be revisited here by changing `access`.)
  static const home = AppRoute(
    name: 'home',
    path: '/',
    access: RouteAccess.authenticatedOnly,
  );
  static const services = AppRoute(
    name: 'services',
    path: '/services',
    access: RouteAccess.authenticatedOnly,
  );
  static const serviceDetail = AppRoute(
    name: 'serviceDetail',
    path: '/services/:slug',
    access: RouteAccess.authenticatedOnly,
  );
  static const profile = AppRoute(
    name: 'profile',
    path: '/profile',
    access: RouteAccess.authenticatedOnly,
  );

  // Becoming and being a provider.
  static const provider = AppRoute(
    name: 'provider',
    path: '/provider',
    access: RouteAccess.authenticatedOnly,
  );
  static const providerProfile = AppRoute(
    name: 'providerProfile',
    path: '/provider/profile',
    access: RouteAccess.authenticatedOnly,
  );
  static const providerServices = AppRoute(
    name: 'providerServices',
    path: '/provider/services',
    access: RouteAccess.authenticatedOnly,
  );
  static const providerApply = AppRoute(
    name: 'providerApply',
    path: '/provider/services/apply',
    access: RouteAccess.authenticatedOnly,
  );

  static const all = [
    splash,
    auth,
    otp,
    home,
    services,
    serviceDetail,
    profile,
    provider,
    providerProfile,
    providerServices,
    providerApply,
  ];

  /// The location of one service's detail screen.
  static String serviceDetailLocation(String slug) =>
      '/services/${Uri.encodeComponent(slug)}';

  /// The apply screen, optionally with a service already ticked.
  static String providerApplyLocation({String? categorySlug}) =>
      categorySlug == null
      ? providerApply.path
      : Uri(
          path: providerApply.path,
          queryParameters: {'category': categorySlug},
        ).toString();
}
