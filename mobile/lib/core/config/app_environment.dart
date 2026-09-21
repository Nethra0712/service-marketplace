/// Deployment environments the app can be built for.
enum AppEnvironment {
  dev,
  staging,
  prod;

  /// Parses the value passed via `--dart-define=APP_ENV=...`.
  static AppEnvironment parse(String value) {
    for (final environment in AppEnvironment.values) {
      if (environment.name == value.trim().toLowerCase()) return environment;
    }
    throw StateError(
      'Unknown APP_ENV "$value". Expected one of: '
      '${AppEnvironment.values.map((e) => e.name).join(', ')}.',
    );
  }

  bool get isProduction => this == AppEnvironment.prod;
}
