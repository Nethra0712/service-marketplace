import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/core/errors/app_exception.dart';

/// Key/value storage backed by the platform keystore (Android Keystore / iOS
/// Keychain). Intended for small secrets such as tokens.
///
/// Features depend on this interface, not on the plugin, so tests can supply
/// an in-memory fake.
abstract interface class SecureStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
  Future<void> deleteAll();
}

/// [SecureStorage] implemented with `flutter_secure_storage`.
class FlutterSecureStorageAdapter implements SecureStorage {
  const FlutterSecureStorageAdapter([
    this._storage = const FlutterSecureStorage(
      iOptions: IOSOptions(
        // Not readable before first unlock, and not migrated to other devices
        // through backups.
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    ),
  ]);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _guard(() => _storage.read(key: key));

  @override
  Future<void> write(String key, String value) =>
      _guard(() => _storage.write(key: key, value: value));

  @override
  Future<void> delete(String key) => _guard(() => _storage.delete(key: key));

  @override
  Future<void> deleteAll() => _guard(_storage.deleteAll);

  Future<T> _guard<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on PlatformException catch (e) {
      throw StorageException('Secure storage operation failed.', cause: e);
    }
  }
}

final secureStorageProvider = Provider<SecureStorage>(
  (ref) => const FlutterSecureStorageAdapter(),
);
