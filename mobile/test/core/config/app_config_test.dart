import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/config/app_environment.dart';

AppConfig build(AppEnvironment env, String url) => AppConfig.validated(
  environment: env,
  apiBaseUrl: url,
  enableNetworkLogging: false,
);

void main() {
  group('AppEnvironment.parse', () {
    test('parses known values case-insensitively', () {
      expect(AppEnvironment.parse('dev'), AppEnvironment.dev);
      expect(AppEnvironment.parse(' Staging '), AppEnvironment.staging);
      expect(AppEnvironment.parse('PROD'), AppEnvironment.prod);
    });

    test('rejects unknown values', () {
      expect(() => AppEnvironment.parse('qa'), throwsStateError);
    });
  });

  group('AppConfig.validated', () {
    test('accepts http in dev', () {
      expect(
        build(AppEnvironment.dev, 'http://10.0.2.2:3000').apiBaseUrl,
        'http://10.0.2.2:3000',
      );
    });

    test('accepts https in prod', () {
      expect(
        build(AppEnvironment.prod, 'https://api.example.com').environment,
        AppEnvironment.prod,
      );
    });

    test('requires https outside dev', () {
      expect(
        () => build(AppEnvironment.staging, 'http://api.example.com'),
        throwsStateError,
      );
      expect(
        () => build(AppEnvironment.prod, 'http://api.example.com'),
        throwsStateError,
      );
    });

    test('rejects empty and non-absolute URLs', () {
      expect(() => build(AppEnvironment.dev, ''), throwsStateError);
      expect(
        () => build(AppEnvironment.dev, 'api.example.com'),
        throwsStateError,
      );
      expect(
        () => build(AppEnvironment.dev, 'ftp://example.com'),
        throwsStateError,
      );
    });
  });
}
