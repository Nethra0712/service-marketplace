/// Technical defaults for HTTP behaviour. These are transport settings, not
/// business rules; business parameters must come from the backend.
abstract final class NetworkDefaults {
  static const connectTimeout = Duration(seconds: 15);
  static const sendTimeout = Duration(seconds: 30);
  static const receiveTimeout = Duration(seconds: 30);
}
