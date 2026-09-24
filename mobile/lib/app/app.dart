import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/locale_provider.dart';
import 'package:mobile/app/router/app_router.dart';
import 'package:mobile/app/theme/app_theme.dart';
import 'package:mobile/features/notifications/presentation/push_message_listener.dart';

/// Shown a push's foreground snackbar without every screen needing its own
/// [ScaffoldMessenger] — see `PushMessageListener`.
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Root widget. Wires theme, localization and routing; contains no feature
/// logic of its own beyond [PushMessageListener], which has to sit above the
/// router to keep working no matter which screen is on top.
class ServiceMarketplaceApp extends ConsumerWidget {
  const ServiceMarketplaceApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PushMessageListener(
      messengerKey: scaffoldMessengerKey,
      child: MaterialApp.router(
        scaffoldMessengerKey: scaffoldMessengerKey,
        onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: ThemeMode.system,
        routerConfig: ref.watch(routerProvider),
        locale: ref.watch(localeProvider),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    );
  }
}
