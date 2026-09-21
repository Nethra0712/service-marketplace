// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Sinhala Sinhalese (`si`).
class AppLocalizationsSi extends AppLocalizations {
  AppLocalizationsSi([String locale = 'si']) : super(locale);

  @override
  String get appTitle => 'සේවා වෙළඳපොළ';

  @override
  String get homeWelcome => 'සේවා වෙළඳපොළට සාදරයෙන් පිළිගනිමු';

  @override
  String get homeSubtitle => 'ගෘහ සේවා, ඔබට අවශ්‍ය වේලාවට.';

  @override
  String homeSignedInAs(String phone) {
    return '$phone ලෙස පිවිස ඇත';
  }

  @override
  String get servicesTitle => 'සේවා';

  @override
  String get profileTitle => 'පැතිකඩ';

  @override
  String get profilePhoneLabel => 'ජංගම දුරකථන අංකය';

  @override
  String get placeholderNotice => 'මෙය තාවකාලික තිරයකි.';

  @override
  String get pageNotFoundTitle => 'පිටුව හමු නොවීය';

  @override
  String get languageLabel => 'භාෂාව';

  @override
  String get languageSystemDefault => 'උපාංගයේ භාෂාව';

  @override
  String get authTitle => 'පිවිසෙන්න';

  @override
  String get authPhoneIntro =>
      'ඔබගේ ජංගම දුරකථන අංකය ඇතුළත් කරන්න. අපි සත්‍යාපන කේතයක් SMS මගින් එවන්නෙමු.';

  @override
  String get authPhoneLabel => 'ජංගම දුරකථන අංකය';

  @override
  String get authPhoneHint => '77 123 4567';

  @override
  String get authSendCode => 'කේතය එවන්න';

  @override
  String get authVerifyTitle => 'ඔබගේ අංකය සත්‍යාපනය කරන්න';

  @override
  String authVerifyInstruction(String phone) {
    return '$phone වෙත එවූ කේතය ඇතුළත් කරන්න.';
  }

  @override
  String get authCodeLabel => 'සත්‍යාපන කේතය';

  @override
  String get authVerify => 'සත්‍යාපනය කරන්න';

  @override
  String get authResendCode => 'නැවත එවන්න';

  @override
  String authResendIn(int seconds) {
    return 'තත්පර $secondsකින් නැවත එවන්න';
  }

  @override
  String get authChangeNumber => 'වෙනත් අංකයක් භාවිත කරන්න';

  @override
  String get authSignOut => 'පිටවන්න';

  @override
  String get errorInvalidPhone =>
      'වලංගු ශ්‍රී ලාංකික ජංගම දුරකථන අංකයක් ඇතුළත් කරන්න.';

  @override
  String get errorInvalidCode => 'එම කේතය වැරදියි, නැතහොත් කල් ඉකුත් වී ඇත.';

  @override
  String get errorAttemptsExceeded =>
      'වැරදි උත්සාහ ගණන ඉතා වැඩිය. නව කේතයක් ඉල්ලන්න.';

  @override
  String get errorCooldown => 'නව කේතයක් ඉල්ලීමට පෙර මොහොතක් රැඳී සිටින්න.';

  @override
  String get errorRateLimited =>
      'උත්සාහ ගණන ඉතා වැඩිය. පසුව නැවත උත්සාහ කරන්න.';

  @override
  String get errorNetwork =>
      'සේවාදායකයට සම්බන්ධ විය නොහැක. ඔබගේ සම්බන්ධතාව පරීක්ෂා කර නැවත උත්සාහ කරන්න.';

  @override
  String get errorSmsUnavailable =>
      'කේතය යැවීමට නොහැකි විය. මඳ වේලාවකින් නැවත උත්සාහ කරන්න.';

  @override
  String get errorAccountSuspended => 'මෙම ගිණුම අත්හිටුවා ඇත.';

  @override
  String get errorGeneric => 'යම් දෙයක් වැරදී ඇත. නැවත උත්සාහ කරන්න.';
}
