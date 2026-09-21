import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/data/session_store.dart';

import '../../../helpers/fakes.dart';

void main() {
  late InMemorySecureStorage storage;
  late SessionStore store;
  final now = DateTime.utc(2026, 1, 1, 12);

  setUp(() {
    storage = InMemorySecureStorage();
    store = SessionStore(storage);
  });

  test('returns null when nothing has been stored', () async {
    expect(await store.read(), isNull);
  });

  test('saves a session and reads it back unchanged', () async {
    final session = makeSession(now);

    await store.write(session);
    final restored = await store.read();

    expect(restored?.accessToken, session.accessToken);
    expect(restored?.refreshToken, session.refreshToken);
    expect(restored?.accessTokenExpiresAt, session.accessTokenExpiresAt);
    expect(restored?.refreshTokenExpiresAt, session.refreshTokenExpiresAt);
  });

  test(
    'keeps the whole session in the secure store under one namespaced key',
    () async {
      await store.write(makeSession(now));

      expect(storage.values.keys, hasLength(1));
      expect(storage.values.keys.single, startsWith('sm.'));
      final stored =
          jsonDecode(storage.values.values.single) as Map<String, dynamic>;
      expect(stored.keys, containsAll(['accessToken', 'refreshToken']));
    },
  );

  test('a second write replaces the first', () async {
    await store.write(makeSession(now, tag: 'old'));
    await store.write(makeSession(now, tag: 'new'));

    expect((await store.read())?.accessToken, 'access-new');
    expect(storage.values, hasLength(1));
  });

  test('clear removes the session', () async {
    await store.write(makeSession(now));

    await store.clear();

    expect(await store.read(), isNull);
    expect(storage.values, isEmpty);
  });

  test('treats unreadable data as signed out and removes it', () async {
    for (final broken in [
      'not json at all',
      '"just a string"',
      '[1, 2, 3]',
      '{}',
      '{"accessToken": 1}',
      jsonEncode({
        'accessToken': 'a',
        'accessTokenExpiresAt': 'not-a-date',
        'refreshToken': 'r',
        'refreshTokenExpiresAt': 'nope',
      }),
    ]) {
      storage.values['sm.auth.session'] = broken;

      expect(await store.read(), isNull, reason: broken);
      expect(
        storage.values,
        isEmpty,
        reason: 'corrupt data was cleaned up: $broken',
      );
    }
  });

  test('surfaces keystore failures as a StorageException', () async {
    storage.failing = true;

    expect(() => store.read(), throwsA(isA<StorageException>()));
    expect(
      () => store.write(makeSession(now)),
      throwsA(isA<StorageException>()),
    );
  });
}
