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
  String homeSignedInAs(String phone) {
    return 'Signed in as $phone';
  }

  @override
  String get servicesTitle => 'Services';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profilePhoneLabel => 'Mobile number';

  @override
  String get placeholderNotice => 'This screen is a placeholder.';

  @override
  String get pageNotFoundTitle => 'Page not found';

  @override
  String get languageLabel => 'Language';

  @override
  String get languageSystemDefault => 'Device language';

  @override
  String get authTitle => 'Sign in';

  @override
  String get authPhoneIntro =>
      'Enter your mobile number and we\'ll text you a verification code.';

  @override
  String get authPhoneLabel => 'Mobile number';

  @override
  String get authPhoneHint => '77 123 4567';

  @override
  String get authSendCode => 'Send code';

  @override
  String get authVerifyTitle => 'Verify your number';

  @override
  String authVerifyInstruction(String phone) {
    return 'Enter the code we sent to $phone.';
  }

  @override
  String get authCodeLabel => 'Verification code';

  @override
  String get authVerify => 'Verify';

  @override
  String get authResendCode => 'Resend code';

  @override
  String authResendIn(int seconds) {
    return 'Resend code in ${seconds}s';
  }

  @override
  String get authChangeNumber => 'Use a different number';

  @override
  String get authSignOut => 'Sign out';

  @override
  String get errorInvalidPhone => 'Enter a valid Sri Lankan mobile number.';

  @override
  String get errorInvalidCode => 'That code is incorrect or has expired.';

  @override
  String get errorAttemptsExceeded =>
      'Too many incorrect attempts. Request a new code.';

  @override
  String get errorCooldown =>
      'Please wait a moment before requesting another code.';

  @override
  String get errorRateLimited => 'Too many attempts. Please try again later.';

  @override
  String get errorNetwork =>
      'Can\'t reach the server. Check your connection and try again.';

  @override
  String get errorSmsUnavailable =>
      'We couldn\'t send the code. Please try again shortly.';

  @override
  String get errorAccountSuspended => 'This account is suspended.';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';
}
