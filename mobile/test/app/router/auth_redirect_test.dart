import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/router/auth_redirect.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';

void main() {
  String? redirect(AuthStatus status, String location) =>
      resolveAuthRedirect(status: status, location: location);

  group('route table', () {
    test('the signed-in app requires a session', () {
      for (final route in [
        AppRoutes.home,
        AppRoutes.services,
        AppRoutes.profile,
      ]) {
        expect(route.access, RouteAccess.authenticatedOnly, reason: route.path);
      }
    });

    test('the sign-in screens are for signed-out users only', () {
      expect(AppRoutes.auth.access, RouteAccess.guestOnly);
      expect(AppRoutes.otp.access, RouteAccess.guestOnly);
    });

    test('paths are unique', () {
      final paths = AppRoutes.all.map((r) => r.path).toList();
      expect(paths.toSet(), hasLength(paths.length));
    });
  });

  group('while the stored session is still being checked (unknown)', () {
    test('every route waits on the splash screen', () {
      for (final route in AppRoutes.all.where((r) => r != AppRoutes.splash)) {
        expect(
          redirect(AuthStatus.unknown, route.path),
          AppRoutes.splash.path,
          reason: route.path,
        );
      }
      expect(
        redirect(AuthStatus.unknown, '/does-not-exist'),
        AppRoutes.splash.path,
      );
    });

    test('the splash itself stays put', () {
      expect(redirect(AuthStatus.unknown, AppRoutes.splash.path), isNull);
    });
  });

  group('signed out', () {
    test('protected routes send the user to sign in', () {
      for (final route in [
        AppRoutes.home,
        AppRoutes.services,
        AppRoutes.profile,
      ]) {
        expect(
          redirect(AuthStatus.unauthenticated, route.path),
          AppRoutes.auth.path,
          reason: route.path,
        );
      }
    });

    test('the sign-in screens are reachable', () {
      expect(redirect(AuthStatus.unauthenticated, AppRoutes.auth.path), isNull);
      expect(redirect(AuthStatus.unauthenticated, AppRoutes.otp.path), isNull);
    });

    test('the splash forwards to sign in once the status is known', () {
      expect(
        redirect(AuthStatus.unauthenticated, AppRoutes.splash.path),
        AppRoutes.auth.path,
      );
    });

    test('ignores query strings when matching', () {
      expect(
        redirect(AuthStatus.unauthenticated, '/profile?tab=1'),
        AppRoutes.auth.path,
      );
    });

    test('leaves unknown locations to the router error page', () {
      expect(redirect(AuthStatus.unauthenticated, '/nope'), isNull);
    });
  });

  group('signed in', () {
    test('the signed-in app is reachable', () {
      for (final route in [
        AppRoutes.home,
        AppRoutes.services,
        AppRoutes.profile,
      ]) {
        expect(
          redirect(AuthStatus.authenticated, route.path),
          isNull,
          reason: route.path,
        );
      }
    });

    test('the sign-in screens send the user home', () {
      expect(
        redirect(AuthStatus.authenticated, AppRoutes.auth.path),
        AppRoutes.home.path,
      );
      expect(
        redirect(AuthStatus.authenticated, AppRoutes.otp.path),
        AppRoutes.home.path,
      );
    });

    test('the splash forwards home once the status is known', () {
      expect(
        redirect(AuthStatus.authenticated, AppRoutes.splash.path),
        AppRoutes.home.path,
      );
    });
  });

  group('custom route tables', () {
    const publicPage = AppRoute(name: 'about', path: '/about');

    test('public routes are open to everyone once the status is known', () {
      for (final status in [
        AuthStatus.unauthenticated,
        AuthStatus.authenticated,
      ]) {
        expect(
          resolveAuthRedirect(
            status: status,
            location: '/about',
            routes: [...AppRoutes.all, publicPage],
          ),
          isNull,
        );
      }
    });
  });
}
