/// Central registry of secure-storage keys, so keys are never scattered as
/// string literals. Intentionally empty for now: no credentials are stored
/// yet. The auth feature will add its keys here.
abstract final class SecureStorageKeys {
  static const String _prefix = 'sm.';

  /// Namespaces a key under the app prefix.
  static String namespaced(String name) => '$_prefix$name';
}
