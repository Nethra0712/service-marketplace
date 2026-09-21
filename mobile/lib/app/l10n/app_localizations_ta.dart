// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Tamil (`ta`).
class AppLocalizationsTa extends AppLocalizations {
  AppLocalizationsTa([String locale = 'ta']) : super(locale);

  @override
  String get appTitle => 'சேவை சந்தை';

  @override
  String get homeWelcome => 'சேவை சந்தைக்கு வரவேற்கிறோம்';

  @override
  String get homeSubtitle => 'வீட்டு சேவைகள், தேவையான நேரத்தில்.';

  @override
  String homeSignedInAs(String phone) {
    return '$phone ஆக உள்நுழைந்துள்ளீர்கள்';
  }

  @override
  String get servicesTitle => 'சேவைகள்';

  @override
  String get profileTitle => 'சுயவிவரம்';

  @override
  String get profilePhoneLabel => 'கைபேசி எண்';

  @override
  String get placeholderNotice => 'இது ஒரு தற்காலிகத் திரை.';

  @override
  String get pageNotFoundTitle => 'பக்கம் கிடைக்கவில்லை';

  @override
  String get languageLabel => 'மொழி';

  @override
  String get languageSystemDefault => 'சாதன மொழி';

  @override
  String get authTitle => 'உள்நுழை';

  @override
  String get authPhoneIntro =>
      'உங்கள் கைபேசி எண்ணை உள்ளிடுங்கள். சரிபார்ப்புக் குறியீட்டை SMS மூலம் அனுப்புவோம்.';

  @override
  String get authPhoneLabel => 'கைபேசி எண்';

  @override
  String get authPhoneHint => '77 123 4567';

  @override
  String get authSendCode => 'குறியீட்டை அனுப்பு';

  @override
  String get authVerifyTitle => 'உங்கள் எண்ணைச் சரிபார்க்கவும்';

  @override
  String authVerifyInstruction(String phone) {
    return '$phone எண்ணுக்கு அனுப்பிய குறியீட்டை உள்ளிடுங்கள்.';
  }

  @override
  String get authCodeLabel => 'சரிபார்ப்புக் குறியீடு';

  @override
  String get authVerify => 'சரிபார்';

  @override
  String get authResendCode => 'மீண்டும் அனுப்பு';

  @override
  String authResendIn(int seconds) {
    return '$seconds வினாடிகளில் மீண்டும் அனுப்பலாம்';
  }

  @override
  String get authChangeNumber => 'வேறு எண்ணைப் பயன்படுத்துங்கள்';

  @override
  String get authSignOut => 'வெளியேறு';

  @override
  String get errorInvalidPhone => 'சரியான இலங்கை கைபேசி எண்ணை உள்ளிடுங்கள்.';

  @override
  String get errorInvalidCode => 'அந்தக் குறியீடு தவறானது அல்லது காலாவதியானது.';

  @override
  String get errorAttemptsExceeded =>
      'பல தவறான முயற்சிகள். புதிய குறியீட்டைக் கோருங்கள்.';

  @override
  String get errorCooldown =>
      'மற்றொரு குறியீட்டைக் கோருவதற்கு முன் சிறிது காத்திருங்கள்.';

  @override
  String get errorRateLimited => 'பல முயற்சிகள். பின்னர் மீண்டும் முயலுங்கள்.';

  @override
  String get errorNetwork =>
      'சேவையகத்தை அடைய முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.';

  @override
  String get errorSmsUnavailable =>
      'குறியீட்டை அனுப்ப முடியவில்லை. சிறிது நேரத்தில் மீண்டும் முயலுங்கள்.';

  @override
  String get errorAccountSuspended => 'இந்தக் கணக்கு இடைநிறுத்தப்பட்டுள்ளது.';

  @override
  String get errorGeneric => 'ஏதோ தவறு நடந்தது. மீண்டும் முயலுங்கள்.';
}
