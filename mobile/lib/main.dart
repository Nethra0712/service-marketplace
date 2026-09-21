import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Throws on invalid configuration, so a misconfigured build fails at launch.
  final config = AppConfig.fromEnvironment();

  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(config),
        // Plugs authentication into the HTTP layer (token + refresh-on-401).
        ...authNetworkOverrides,
      ],
      child: const ServiceMarketplaceApp(),
    ),
  );
}
