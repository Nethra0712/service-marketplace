import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/router/auth_redirect.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';

void main() {
  const protected = AppRoute(
    name: 'protected',
    path: '/protected',
    access: RouteAccess.authenticatedOnly,
  );
  final routes = [...AppRoutes.all, protected];

  String? redirect(AuthStatus status, String location) =>
      resolveAuthRedirect(status: status, location: location, routes: routes);

  group('current route table (auth not implemented)', () {
    test('every route is reachable while signed out', () {
      for (final route in AppRoutes.all) {
        expect(
          resolveAuthRedirect(
            status: AuthStatus.unauthenticated,
            location: route.path,
          ),
          isNull,
          reason: route.path,
        );
      }
    });
  });

  group('access rules', () {
    test('public routes are open to everyone', () {
      expect(redirect(AuthStatus.unauthenticated, '/services'), isNull);
      expect(redirect(AuthStatus.authenticated, '/services'), isNull);
    });

    test('authenticatedOnly sends signed-out users to /auth', () {
      expect(
        redirect(AuthStatus.unauthenticated, '/protected'),
        AppRoutes.auth.path,
      );
      expect(redirect(AuthStatus.authenticated, '/protected'), isNull);
    });

    test('guestOnly sends signed-in users home', () {
      expect(redirect(AuthStatus.authenticated, '/auth'), AppRoutes.home.path);
      expect(redirect(AuthStatus.unauthenticated, '/auth'), isNull);
    });

    test('ignores query strings when matching', () {
      expect(
        redirect(AuthStatus.unauthenticated, '/protected?x=1'),
        AppRoutes.auth.path,
      );
    });

    test('unknown locations are left to the router error page', () {
      expect(redirect(AuthStatus.unauthenticated, '/nope'), isNull);
    });
  });
}
