import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/application/session_manager.dart';
import 'package:mobile/features/auth/data/session_store.dart';
import 'package:mobile/features/auth/domain/auth_session.dart';

import '../../../helpers/fakes.dart';

void main() {
  late AuthHarness h;
  late SessionStore store;
  late SessionManager manager;
  late List<SessionEvent> events;

  setUp(() {
    h = AuthHarness();
    store = SessionStore(h.storage);
    manager = SessionManager(
      store: store,
      repository: h.auth,
      now: h.clock.call,
    );
    events = [];
    manager.events.listen(events.add);
  });

  tearDown(() {
    manager.dispose();
    h.dispose();
  });

  group('restore', () {
    test('finds nothing when signed out', () async {
      expect(await manager.restore(), isNull);
      expect(manager.hasSession, isFalse);
    });

    test('restores a saved session', () async {
      await store.write(makeSession(h.clock.now));

      final restored = await manager.restore();

      expect(restored?.accessToken, 'access-1');
      expect(manager.hasSession, isTrue);
    });

    test(
      'discards a session whose refresh token has expired, and clears storage',
      () async {
        await store.write(makeSession(h.clock.now));
        h.clock.advance(const Duration(days: 31));

        expect(await manager.restore(), isNull);
        expect(manager.hasSession, isFalse);
        expect(h.storage.values, isEmpty);
      },
    );

    test('behaves as signed out if the keystore cannot be read', () async {
      await store.write(makeSession(h.clock.now));
      h.storage.failing = true;

      expect(await manager.restore(), isNull);
      expect(manager.hasSession, isFalse);
    });
  });

  group('readAccessToken', () {
    test('is null when signed out', () async {
      expect(await manager.readAccessToken(), isNull);
    });

    test(
      'returns the current token without any network call while it is fresh',
      () async {
        await manager.start(makeSession(h.clock.now));

        expect(await manager.readAccessToken(), 'access-1');
        expect(h.auth.refreshCalls, isEmpty);
      },
    );

    test('renews the token first when it is about to expire', () async {
      await manager.start(makeSession(h.clock.now));
      h.clock.advance(const Duration(minutes: 14, seconds: 45));

      final token = await manager.readAccessToken();

      expect(h.auth.refreshCalls, ['refresh-1']);
      expect(token, 'access-refreshed-1');
    });

    test(
      'falls back to the old token if renewing fails because we are offline',
      () async {
        await manager.start(makeSession(h.clock.now));
        h.clock.advance(const Duration(minutes: 20));
        h.auth.onRefresh = (_) => throw const NetworkException('offline');

        expect(await manager.readAccessToken(), 'access-1');
        expect(manager.hasSession, isTrue);
      },
    );
  });

  group('refresh', () {
    test(
      'sends the current refresh token, then keeps and stores the new session',
      () async {
        await manager.start(makeSession(h.clock.now));

        expect(await manager.refresh(), isTrue);

        expect(h.auth.refreshCalls, ['refresh-1']);
        expect((await store.read())?.refreshToken, 'refresh-refreshed-1');
        expect(await manager.readAccessToken(), 'access-refreshed-1');
      },
    );

    test('shares one network call between simultaneous callers', () async {
      // Refresh tokens are single-use: two parallel refreshes with the same token
      // would look like theft to the server and end the session.
      await manager.start(makeSession(h.clock.now));
      final gate = Completer<AuthSession>();
      h.auth.onRefresh = (_) => gate.future;

      final results = Future.wait([
        manager.refresh(),
        manager.refresh(),
        manager.refresh(),
      ]);
      gate.complete(makeSession(h.clock.now, tag: 'new'));

      expect(await results, [true, true, true]);
      expect(h.auth.refreshCalls, hasLength(1));
    });

    test('can refresh again later, using the newest token each time', () async {
      await manager.start(makeSession(h.clock.now));

      await manager.refresh();
      await manager.refresh();

      expect(h.auth.refreshCalls, ['refresh-1', 'refresh-refreshed-1']);
    });

    test('does nothing when signed out', () async {
      expect(await manager.refresh(), isFalse);
      expect(h.auth.refreshCalls, isEmpty);
    });

    test('ends the session, clears storage and announces it when the server rejects the token', () async {
      await manager.start(makeSession(h.clock.now));
      h.auth.onRefresh = (_) => throw const UnauthorizedException(
        'no',
        code: 'INVALID_REFRESH_TOKEN',
      );

      expect(await manager.refresh(), isFalse);
      await pumpEventQueue();

      expect(manager.hasSession, isFalse);
      expect(h.storage.values, isEmpty);
      expect(events, [SessionEvent.expired]);
    });

    test('keeps the session when the failure is only connectivity', () async {
      await manager.start(makeSession(h.clock.now));

      for (final failure in <AppException>[
        const NetworkException('offline'),
        const NetworkTimeoutException('slow'),
        const ServerException('boom', statusCode: 503),
        const ApiException('rate limited', statusCode: 429),
      ]) {
        h.auth.onRefresh = (_) => throw failure;

        expect(await manager.refresh(), isFalse, reason: '$failure');
        expect(manager.hasSession, isTrue, reason: '$failure');
      }
      await pumpEventQueue();
      expect(events, isEmpty);
      expect(await store.read(), isNotNull);
    });

    test('does not bring a session back to life if the user signed out mid-refresh', () async {
      await manager.start(makeSession(h.clock.now));
      final gate = Completer<AuthSession>();
      h.auth.onRefresh = (_) => gate.future;

      final refreshing = manager.refresh();
      await manager.end();
      gate.complete(makeSession(h.clock.now, tag: 'late'));
      await refreshing;

      expect(manager.hasSession, isFalse);
      expect(h.storage.values, isEmpty);
    });

    test(
      'does not announce expiry for a session the user already ended',
      () async {
        await manager.start(makeSession(h.clock.now));
        final gate = Completer<AuthSession>();
        h.auth.onRefresh = (_) => gate.future;

        final refreshing = manager.refresh();
        await manager.end();
        gate.completeError(const UnauthorizedException('no'));
        await refreshing;
        await pumpEventQueue();

        expect(events, isEmpty);
      },
    );
  });

  group('end (sign out)', () {
    test(
      'forgets the credentials and tells the server which session to end',
      () async {
        await manager.start(makeSession(h.clock.now));

        await manager.end();

        expect(manager.hasSession, isFalse);
        expect(h.storage.values, isEmpty);
        expect(h.auth.logoutCalls, ['refresh-1']);
      },
    );

    test('still signs out locally when the server cannot be reached', () async {
      await manager.start(makeSession(h.clock.now));
      h.auth.onLogout = (_) => throw const NetworkException('offline');

      await manager.end();

      expect(manager.hasSession, isFalse);
      expect(h.storage.values, isEmpty);
    });

    test('is harmless when nobody is signed in', () async {
      await manager.end();

      expect(h.auth.logoutCalls, isEmpty);
    });
  });
}
