import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/auth/data/session_store.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';

import '../../../helpers/fakes.dart';

void main() {
  late AuthHarness h;
  late ProviderContainer container;

  setUp(() {
    h = AuthHarness();
    container = h.container;
  });
  tearDown(() => h.dispose());

  Future<void> restored() =>
      container.read(authControllerProvider.notifier).ready;

  group('session restoration at launch', () {
    test('starts in the unknown state, so the UI can show a splash', () {
      expect(container.read(authControllerProvider).status, AuthStatus.unknown);
      expect(container.read(authStatusProvider), AuthStatus.unknown);
    });

    test('is signed out when nothing is stored', () async {
      container.read(authControllerProvider);
      await restored();

      expect(container.read(authStatusProvider), AuthStatus.unauthenticated);
      expect(h.users.calls, 0);
    });

    test('signs back in from a stored session and loads the user', () async {
      await SessionStore(h.storage).write(makeSession(h.clock.now));
      container.read(authControllerProvider);
      await restored();

      final state = container.read(authControllerProvider);
      expect(state.status, AuthStatus.authenticated);
      expect(state.user?.phone, '+94771234567');
      expect(container.read(currentUserProvider)?.id, 'user-1');
    });

    test('drops a stored session whose refresh token has expired, without calling the server', () async {
      await SessionStore(h.storage).write(makeSession(h.clock.now));
      h.clock.advance(const Duration(days: 31));
      container.read(authControllerProvider);
      await restored();

      expect(container.read(authStatusProvider), AuthStatus.unauthenticated);
      expect(h.storage.values, isEmpty);
      expect(h.users.calls, 0);
    });

    test(
      'signs out and forgets the session if the server refuses it',
      () async {
        await SessionStore(h.storage).write(makeSession(h.clock.now));
        h.users.onFetch = () => throw const UnauthorizedException('no');
        container.read(authControllerProvider);
        await restored();

        expect(container.read(authStatusProvider), AuthStatus.unauthenticated);
        expect(h.storage.values, isEmpty);
      },
    );

    test('signs out a suspended account', () async {
      await SessionStore(h.storage).write(makeSession(h.clock.now));
      h.users.onFetch = () =>
          throw const ForbiddenException('no', code: 'ACCOUNT_SUSPENDED');
      container.read(authControllerProvider);
      await restored();

      expect(container.read(authStatusProvider), AuthStatus.unauthenticated);
    });

    test('stays signed in when the app is opened offline', () async {
      await SessionStore(h.storage).write(makeSession(h.clock.now));
      h.users.onFetch = () => throw const NetworkException('offline');
      container.read(authControllerProvider);
      await restored();

      final state = container.read(authControllerProvider);
      expect(state.status, AuthStatus.authenticated);
      expect(
        state.user,
        isNull,
      ); // Not loaded yet, but the person is not kicked out.
      expect(h.storage.values, isNotEmpty);
    });

    test(
      'a sign-in that finishes first is not overwritten by the restore',
      () async {
        final notifier = container.read(authControllerProvider.notifier);

        await notifier.signIn(makeSession(h.clock.now));
        await notifier.ready;

        expect(container.read(authStatusProvider), AuthStatus.authenticated);
      },
    );
  });

  group('signing in', () {
    test(
      'stores the session securely and becomes authenticated with the user',
      () async {
        container.read(authControllerProvider);
        await restored();

        await container
            .read(authControllerProvider.notifier)
            .signIn(makeSession(h.clock.now, tag: 'new'));

        expect(container.read(authStatusProvider), AuthStatus.authenticated);
        expect(container.read(currentUserProvider)?.phone, '+94771234567');
        expect(
          (await SessionStore(h.storage).read())?.accessToken,
          'access-new',
        );
      },
    );

    test('is still signed in if the user cannot be loaded yet', () async {
      container.read(authControllerProvider);
      await restored();
      h.users.onFetch = () => throw const NetworkException('offline');

      await container
          .read(authControllerProvider.notifier)
          .signIn(makeSession(h.clock.now));

      expect(container.read(authStatusProvider), AuthStatus.authenticated);
      expect(container.read(currentUserProvider), isNull);
    });

    test('notifies listeners of each status change in order', () async {
      final seen = <AuthStatus>[];
      container.listen(authStatusProvider, (_, next) => seen.add(next));
      container.read(authControllerProvider);
      await restored();
      await pumpEventQueue(); // Riverpod delivers listener updates on its own tick.

      await container
          .read(authControllerProvider.notifier)
          .signIn(makeSession(h.clock.now));
      await pumpEventQueue();
      await container.read(authControllerProvider.notifier).logout();
      await pumpEventQueue();

      expect(seen, [
        AuthStatus.unauthenticated,
        AuthStatus.authenticated,
        AuthStatus.unauthenticated,
      ]);
    });
  });

  group('signing out', () {
    Future<void> signedIn() async {
      container.read(authControllerProvider);
      await restored();
      await container
          .read(authControllerProvider.notifier)
          .signIn(makeSession(h.clock.now));
    }

    test(
      'clears local state and stored credentials, and tells the server',
      () async {
        await signedIn();

        await container.read(authControllerProvider.notifier).logout();

        expect(container.read(authStatusProvider), AuthStatus.unauthenticated);
        expect(container.read(currentUserProvider), isNull);
        expect(h.storage.values, isEmpty);
        expect(h.auth.logoutCalls, ['refresh-1']);
      },
    );

    test(
      'flips to signed out immediately, before the server has answered',
      () async {
        await signedIn();
        h.auth.onLogout = (_) async {
          // The state must already be signed out while this call is pending.
          expect(
            container.read(authStatusProvider),
            AuthStatus.unauthenticated,
          );
        };

        await container.read(authControllerProvider.notifier).logout();

        expect(h.auth.logoutCalls, hasLength(1));
      },
    );

    test('works with no connection', () async {
      await signedIn();
      h.auth.onLogout = (_) => throw const NetworkException('offline');

      await container.read(authControllerProvider.notifier).logout();

      expect(container.read(authStatusProvider), AuthStatus.unauthenticated);
      expect(h.storage.values, isEmpty);
    });

    test('a signed-out device cannot be restored after restart', () async {
      await signedIn();
      await container.read(authControllerProvider.notifier).logout();

      final restart = ProviderContainer(overrides: h.overrides);
      addTearDown(restart.dispose);
      restart.read(authControllerProvider);
      await restart.read(authControllerProvider.notifier).ready;

      expect(restart.read(authStatusProvider), AuthStatus.unauthenticated);
    });
  });

  group('session ends without the user asking', () {
    test('a rejected refresh token signs the user out', () async {
      container.read(authControllerProvider);
      await restored();
      await container
          .read(authControllerProvider.notifier)
          .signIn(makeSession(h.clock.now));
      h.auth.onRefresh = (_) => throw const UnauthorizedException(
        'no',
        code: 'INVALID_REFRESH_TOKEN',
      );

      await container.read(sessionManagerProvider).refresh();
      await pumpEventQueue();

      expect(container.read(authStatusProvider), AuthStatus.unauthenticated);
      expect(h.storage.values, isEmpty);
    });

    test(
      'a failed refresh caused only by connectivity does not sign the user out',
      () async {
        container.read(authControllerProvider);
        await restored();
        await container
            .read(authControllerProvider.notifier)
            .signIn(makeSession(h.clock.now));
        h.auth.onRefresh = (_) => throw const NetworkException('offline');

        await container.read(sessionManagerProvider).refresh();
        await pumpEventQueue();

        expect(container.read(authStatusProvider), AuthStatus.authenticated);
      },
    );
  });
}
