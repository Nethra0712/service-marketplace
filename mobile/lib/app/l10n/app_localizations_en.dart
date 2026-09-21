// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Service Marketplace';

  @override
  String get homeWelcome => 'Welcome to Service Marketplace';

  @override
  String get homeSubtitle => 'Home services, on demand.';

  @override
  String get servicesTitle => 'Services';

  @override
  String get profileTitle => 'Profile';

  @override
  String get authTitle => 'Sign in';

  @override
  String get placeholderNotice => 'This screen is a placeholder.';

  @override
  String get pageNotFoundTitle => 'Page not found';

  @override
  String get languageLabel => 'Language';

  @override
  String get languageSystemDefault => 'Device language';
}
