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

  @override
  String get commonRetry => 'Try again';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get servicesSearchHint => 'Search services';

  @override
  String get servicesFilterAll => 'All';

  @override
  String get servicesEmpty => 'No services are available yet.';

  @override
  String get servicesNoMatch => 'No services match your search.';

  @override
  String get servicesClearFilters => 'Clear filters';

  @override
  String get pricingFixed => 'Fixed price';

  @override
  String get pricingHourly => 'Per hour';

  @override
  String get pricingQuote => 'Quote on request';

  @override
  String get pricingFixedHelp => 'A set price for the job.';

  @override
  String get pricingHourlyHelp =>
      'You pay for the time the provider spends on the job.';

  @override
  String get pricingQuoteHelp =>
      'The provider quotes a price once they understand the job.';

  @override
  String get serviceDetailPricing => 'How pricing works';

  @override
  String get serviceDetailAvailableIn => 'Available in';

  @override
  String serviceDetailProviders(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count approved providers',
      one: '1 approved provider',
      zero: 'No approved providers yet',
    );
    return '$_temp0';
  }

  @override
  String get serviceDetailNotAvailable =>
      'This service isn\'t available right now.';

  @override
  String get serviceDetailOffer => 'Offer this service';

  @override
  String get homeProviderArea => 'Provider area';

  @override
  String get providerAreaTitle => 'Provider area';

  @override
  String get providerIntroTitle => 'Earn by offering your skills';

  @override
  String get providerIntroBody =>
      'Create a provider profile, choose the services you offer, and we\'ll review your application.';

  @override
  String get providerSetupProfile => 'Set up provider profile';

  @override
  String get providerEditProfile => 'Edit profile';

  @override
  String get providerProfileTitle => 'Provider profile';

  @override
  String get providerFullNameLabel => 'Full name';

  @override
  String get providerYearsLabel => 'Years of experience';

  @override
  String get providerBioLabel => 'About you';

  @override
  String get providerBioHint => 'Describe your skills and the work you do.';

  @override
  String get providerSave => 'Save profile';

  @override
  String get providerSaved => 'Profile saved.';

  @override
  String get providerNameRequired => 'Enter your full name.';

  @override
  String get providerNameTooLong =>
      'Your name must be 100 characters or fewer.';

  @override
  String get providerYearsInvalid => 'Enter a whole number from 0 to 60.';

  @override
  String get providerBioTooLong => 'Keep this to 1000 characters or fewer.';

  @override
  String get providerSubmitForReview => 'Submit for review';

  @override
  String get providerSubmitted => 'Profile submitted for review.';

  @override
  String providerReviewNote(String note) {
    return 'Reviewer\'s note: $note';
  }

  @override
  String get verificationDraft => 'Not submitted';

  @override
  String get verificationSubmitted => 'Under review';

  @override
  String get verificationVerified => 'Verified';

  @override
  String get verificationRejected => 'Not approved';

  @override
  String get verificationDraftHelp =>
      'Submit your profile so we can review it.';

  @override
  String get verificationSubmittedHelp =>
      'We\'re reviewing your profile. The result will appear here.';

  @override
  String get verificationVerifiedHelp =>
      'Your profile is verified. Customers can book you for services that are approved.';

  @override
  String get verificationRejectedHelp =>
      'Your profile wasn\'t approved. Update it and submit again.';

  @override
  String get providerMyServices => 'My services';

  @override
  String get providerManageServices => 'Manage services';

  @override
  String get providerAddServices => 'Add services';

  @override
  String providerServicesSummary(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count service applications',
      one: '1 service application',
      zero: 'You haven\'t applied for any services yet.',
    );
    return '$_temp0';
  }

  @override
  String get providerVerifyFirst =>
      'Customers can only find you once your profile is verified.';

  @override
  String get applicationPending => 'Pending review';

  @override
  String get applicationApproved => 'Approved';

  @override
  String get applicationRejected => 'Rejected';

  @override
  String get applicationSuspended => 'Suspended';

  @override
  String get applicationPendingHelp => 'We\'re reviewing this application.';

  @override
  String get applicationApprovedHelp => 'You\'re approved for this service.';

  @override
  String get applicationRejectedHelp =>
      'This application wasn\'t approved. You can apply again.';

  @override
  String get applicationSuspendedHelp =>
      'You can\'t take jobs in this service right now.';

  @override
  String get providerApplyTitle => 'Apply for services';

  @override
  String get providerApplyIntro =>
      'Choose the services you want to offer. Each one is reviewed separately.';

  @override
  String get providerApplyCity => 'City';

  @override
  String get providerApplyNothingLeft =>
      'You\'ve already applied for every available service.';

  @override
  String get providerApplyNeedProfile =>
      'Set up your provider profile before applying for services.';

  @override
  String providerApplyButton(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Apply for $count services',
      one: 'Apply for 1 service',
    );
    return '$_temp0';
  }

  @override
  String providerApplySent(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count applications sent.',
      one: 'Application sent.',
    );
    return '$_temp0';
  }

  @override
  String providerApplyPartial(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count applications couldn\'t be sent.',
      one: '1 application couldn\'t be sent.',
    );
    return '$_temp0';
  }

  @override
  String get providerResubmit => 'Apply again';

  @override
  String get providerResubmitted => 'Application sent again.';

  @override
  String get providerWithdraw => 'Withdraw';

  @override
  String get providerWithdrawTitle => 'Withdraw application?';

  @override
  String providerWithdrawBody(String service) {
    return 'Withdraw your application for $service? You can apply again later.';
  }

  @override
  String get providerWithdrawn => 'Application withdrawn.';

  @override
  String get errorAlreadyApplied => 'You\'ve already applied for this service.';

  @override
  String get errorProfileIncomplete =>
      'Add your name and apply for at least one service before submitting.';

  @override
  String get errorInvalidState =>
      'That can\'t be done in the current state. Refresh and try again.';

  @override
  String get errorProfileRequired => 'Set up your provider profile first.';

  @override
  String get errorNotFound =>
      'We couldn\'t find that. It may no longer be available.';

  @override
  String get errorValidation => 'Please check the details you entered.';
}
