import 'dart:convert';

import 'package:mobile/core/storage/secure_storage.dart';
import 'package:mobile/core/storage/secure_storage_keys.dart';
import 'package:mobile/features/auth/domain/auth_session.dart';

/// Persists the signed-in session in the platform keystore (Android Keystore /
/// iOS Keychain), never in plain preferences or files.
///
/// The whole session is one JSON value under one key, so reads and writes are
/// all-or-nothing: there is no state with an access token but no refresh token.
class SessionStore {
  SessionStore(this._storage);

  final SecureStorage _storage;

  static final String _key = SecureStorageKeys.namespaced('auth.session');

  /// The stored session, or null if there is none. Unreadable data (a partial
  /// write, an old format) is deleted and treated as signed out.
  Future<AuthSession?> read() async {
    final raw = await _storage.read(_key);
    if (raw == null) return null;
    try {
      return AuthSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } on FormatException {
      await _storage.delete(_key);
      return null;
    } on TypeError {
      await _storage.delete(_key);
      return null;
    }
  }

  Future<void> write(AuthSession session) =>
      _storage.write(_key, jsonEncode(session.toJson()));

  Future<void> clear() => _storage.delete(_key);
}
