import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/app_localizations.dart';

/// Languages the app ships with, in display order.
abstract final class AppLocales {
  static const Locale english = Locale('en');
  static const Locale sinhala = Locale('si');
  static const Locale tamil = Locale('ta');

  /// Kept in sync with the generated [AppLocalizations.supportedLocales].
  static List<Locale> get supported => AppLocalizations.supportedLocales;

  /// Language names are shown in their own script and are intentionally not
  /// translated, so a user can always find their language.
  static String nativeName(Locale locale) => switch (locale.languageCode) {
    'si' => 'සිංහල',
    'ta' => 'தமிழ்',
    _ => 'English',
  };
}

/// The user's language choice. `null` follows the device language.
///
/// In-memory only for now; persisting the choice is a later concern.
class LocaleNotifier extends Notifier<Locale?> {
  @override
  Locale? build() => null;

  // ignore: use_setters_to_change_properties
  void select(Locale? locale) => state = locale;
}

final localeProvider = NotifierProvider<LocaleNotifier, Locale?>(
  LocaleNotifier.new,
);
