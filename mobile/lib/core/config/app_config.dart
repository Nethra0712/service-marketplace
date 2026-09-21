import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/config/app_environment.dart';

/// Build-time configuration, supplied with `--dart-define` (see
/// `config/*.json` and the README). Nothing in here is a secret: anything
/// compiled into a mobile binary can be extracted, so secrets never belong in
/// this class.
class AppConfig {
  const AppConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.enableNetworkLogging,
  });

  /// Reads the configuration compiled into the app via `--dart-define`.
  ///
  /// Fails fast at startup when the configuration is invalid rather than
  /// surfacing confusing network errors later.
  factory AppConfig.fromEnvironment() {
    const rawEnvironment = String.fromEnvironment(
      'APP_ENV',
      defaultValue: 'dev',
    );
    const rawBaseUrl = String.fromEnvironment('API_BASE_URL');
    final environment = AppEnvironment.parse(rawEnvironment);

    return AppConfig.validated(
      environment: environment,
      apiBaseUrl: rawBaseUrl.isEmpty
          ? _devFallbackBaseUrl(environment)
          : rawBaseUrl,
      enableNetworkLogging: environment == AppEnvironment.dev,
    );
  }

  /// Builds a config after validating [apiBaseUrl].
  factory AppConfig.validated({
    required AppEnvironment environment,
    required String apiBaseUrl,
    required bool enableNetworkLogging,
  }) {
    if (apiBaseUrl.isEmpty) {
      throw StateError(
        'API_BASE_URL is required for the "${environment.name}" environment. '
        'Pass --dart-define-from-file=config/${environment.name}.json.',
      );
    }
    final uri = Uri.tryParse(apiBaseUrl);
    final isAbsoluteHttp =
        uri != null &&
        uri.hasAuthority &&
        (uri.scheme == 'http' || uri.scheme == 'https');
    if (!isAbsoluteHttp) {
      throw StateError('API_BASE_URL must be an absolute http(s) URL.');
    }
    if (environment != AppEnvironment.dev && uri.scheme != 'https') {
      throw StateError(
        'API_BASE_URL must use https outside the dev environment.',
      );
    }
    return AppConfig(
      environment: environment,
      apiBaseUrl: apiBaseUrl,
      enableNetworkLogging: enableNetworkLogging,
    );
  }

  final AppEnvironment environment;
  final String apiBaseUrl;
  final bool enableNetworkLogging;

  // Lets a plain `flutter run` work in dev without any flags. No backend
  // exists yet, so nothing calls this address. 10.0.2.2 is the Android
  // emulator's alias for the host machine.
  static String _devFallbackBaseUrl(AppEnvironment environment) =>
      environment == AppEnvironment.dev ? 'http://10.0.2.2:3000' : '';
}

/// The active [AppConfig]. Overridden in `main()` (and in tests), so a missing
/// override is a programming error rather than a silent default.
final appConfigProvider = Provider<AppConfig>(
  (ref) => throw UnimplementedError(
    'appConfigProvider must be overridden in the root ProviderScope.',
  ),
);
