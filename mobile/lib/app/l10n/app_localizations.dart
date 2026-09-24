import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_si.dart';
import 'app_localizations_ta.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('si'),
    Locale('ta'),
  ];

  /// Application name shown in the app bar and task switcher.
  ///
  /// In en, this message translates to:
  /// **'Service Marketplace'**
  String get appTitle;

  /// No description provided for @homeWelcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome to Service Marketplace'**
  String get homeWelcome;

  /// No description provided for @homeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Home services, on demand.'**
  String get homeSubtitle;

  /// No description provided for @homeSignedInAs.
  ///
  /// In en, this message translates to:
  /// **'Signed in as {phone}'**
  String homeSignedInAs(String phone);

  /// No description provided for @servicesTitle.
  ///
  /// In en, this message translates to:
  /// **'Services'**
  String get servicesTitle;

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitle;

  /// No description provided for @profilePhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get profilePhoneLabel;

  /// No description provided for @placeholderNotice.
  ///
  /// In en, this message translates to:
  /// **'This screen is a placeholder.'**
  String get placeholderNotice;

  /// No description provided for @pageNotFoundTitle.
  ///
  /// In en, this message translates to:
  /// **'Page not found'**
  String get pageNotFoundTitle;

  /// No description provided for @languageLabel.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageLabel;

  /// No description provided for @languageSystemDefault.
  ///
  /// In en, this message translates to:
  /// **'Device language'**
  String get languageSystemDefault;

  /// No description provided for @authTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get authTitle;

  /// No description provided for @authPhoneIntro.
  ///
  /// In en, this message translates to:
  /// **'Enter your mobile number and we\'ll text you a verification code.'**
  String get authPhoneIntro;

  /// No description provided for @authPhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get authPhoneLabel;

  /// No description provided for @authPhoneHint.
  ///
  /// In en, this message translates to:
  /// **'77 123 4567'**
  String get authPhoneHint;

  /// No description provided for @authSendCode.
  ///
  /// In en, this message translates to:
  /// **'Send code'**
  String get authSendCode;

  /// No description provided for @authVerifyTitle.
  ///
  /// In en, this message translates to:
  /// **'Verify your number'**
  String get authVerifyTitle;

  /// No description provided for @authVerifyInstruction.
  ///
  /// In en, this message translates to:
  /// **'Enter the code we sent to {phone}.'**
  String authVerifyInstruction(String phone);

  /// No description provided for @authCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Verification code'**
  String get authCodeLabel;

  /// No description provided for @authVerify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get authVerify;

  /// No description provided for @authResendCode.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get authResendCode;

  /// No description provided for @authResendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend code in {seconds}s'**
  String authResendIn(int seconds);

  /// No description provided for @authChangeNumber.
  ///
  /// In en, this message translates to:
  /// **'Use a different number'**
  String get authChangeNumber;

  /// No description provided for @authSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get authSignOut;

  /// No description provided for @errorInvalidPhone.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid Sri Lankan mobile number.'**
  String get errorInvalidPhone;

  /// No description provided for @errorInvalidCode.
  ///
  /// In en, this message translates to:
  /// **'That code is incorrect or has expired.'**
  String get errorInvalidCode;

  /// No description provided for @errorAttemptsExceeded.
  ///
  /// In en, this message translates to:
  /// **'Too many incorrect attempts. Request a new code.'**
  String get errorAttemptsExceeded;

  /// No description provided for @errorCooldown.
  ///
  /// In en, this message translates to:
  /// **'Please wait a moment before requesting another code.'**
  String get errorCooldown;

  /// No description provided for @errorRateLimited.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please try again later.'**
  String get errorRateLimited;

  /// No description provided for @errorNetwork.
  ///
  /// In en, this message translates to:
  /// **'Can\'t reach the server. Check your connection and try again.'**
  String get errorNetwork;

  /// No description provided for @errorSmsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t send the code. Please try again shortly.'**
  String get errorSmsUnavailable;

  /// No description provided for @errorAccountSuspended.
  ///
  /// In en, this message translates to:
  /// **'This account is suspended.'**
  String get errorAccountSuspended;

  /// No description provided for @errorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorGeneric;

  /// No description provided for @commonRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get commonRetry;

  /// No description provided for @commonCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get commonCancel;

  /// No description provided for @servicesSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search services'**
  String get servicesSearchHint;

  /// No description provided for @servicesFilterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get servicesFilterAll;

  /// No description provided for @servicesEmpty.
  ///
  /// In en, this message translates to:
  /// **'No services are available yet.'**
  String get servicesEmpty;

  /// No description provided for @servicesNoMatch.
  ///
  /// In en, this message translates to:
  /// **'No services match your search.'**
  String get servicesNoMatch;

  /// No description provided for @servicesClearFilters.
  ///
  /// In en, this message translates to:
  /// **'Clear filters'**
  String get servicesClearFilters;

  /// No description provided for @pricingFixed.
  ///
  /// In en, this message translates to:
  /// **'Fixed price'**
  String get pricingFixed;

  /// No description provided for @pricingHourly.
  ///
  /// In en, this message translates to:
  /// **'Per hour'**
  String get pricingHourly;

  /// No description provided for @pricingQuote.
  ///
  /// In en, this message translates to:
  /// **'Quote on request'**
  String get pricingQuote;

  /// No description provided for @pricingFixedHelp.
  ///
  /// In en, this message translates to:
  /// **'A set price for the job.'**
  String get pricingFixedHelp;

  /// No description provided for @pricingHourlyHelp.
  ///
  /// In en, this message translates to:
  /// **'You pay for the time the provider spends on the job.'**
  String get pricingHourlyHelp;

  /// No description provided for @pricingQuoteHelp.
  ///
  /// In en, this message translates to:
  /// **'The provider quotes a price once they understand the job.'**
  String get pricingQuoteHelp;

  /// No description provided for @serviceDetailPricing.
  ///
  /// In en, this message translates to:
  /// **'How pricing works'**
  String get serviceDetailPricing;

  /// No description provided for @serviceDetailAvailableIn.
  ///
  /// In en, this message translates to:
  /// **'Available in'**
  String get serviceDetailAvailableIn;

  /// No description provided for @serviceDetailProviders.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No approved providers yet} =1{1 approved provider} other{{count} approved providers}}'**
  String serviceDetailProviders(int count);

  /// No description provided for @serviceDetailNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'This service isn\'t available right now.'**
  String get serviceDetailNotAvailable;

  /// No description provided for @serviceDetailOffer.
  ///
  /// In en, this message translates to:
  /// **'Offer this service'**
  String get serviceDetailOffer;

  /// No description provided for @homeProviderArea.
  ///
  /// In en, this message translates to:
  /// **'Provider area'**
  String get homeProviderArea;

  /// No description provided for @providerAreaTitle.
  ///
  /// In en, this message translates to:
  /// **'Provider area'**
  String get providerAreaTitle;

  /// No description provided for @providerIntroTitle.
  ///
  /// In en, this message translates to:
  /// **'Earn by offering your skills'**
  String get providerIntroTitle;

  /// No description provided for @providerIntroBody.
  ///
  /// In en, this message translates to:
  /// **'Create a provider profile, choose the services you offer, and we\'ll review your application.'**
  String get providerIntroBody;

  /// No description provided for @providerSetupProfile.
  ///
  /// In en, this message translates to:
  /// **'Set up provider profile'**
  String get providerSetupProfile;

  /// No description provided for @providerEditProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit profile'**
  String get providerEditProfile;

  /// No description provided for @providerProfileTitle.
  ///
  /// In en, this message translates to:
  /// **'Provider profile'**
  String get providerProfileTitle;

  /// No description provided for @providerFullNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get providerFullNameLabel;

  /// No description provided for @providerYearsLabel.
  ///
  /// In en, this message translates to:
  /// **'Years of experience'**
  String get providerYearsLabel;

  /// No description provided for @providerBioLabel.
  ///
  /// In en, this message translates to:
  /// **'About you'**
  String get providerBioLabel;

  /// No description provided for @providerBioHint.
  ///
  /// In en, this message translates to:
  /// **'Describe your skills and the work you do.'**
  String get providerBioHint;

  /// No description provided for @providerSave.
  ///
  /// In en, this message translates to:
  /// **'Save profile'**
  String get providerSave;

  /// No description provided for @providerSaved.
  ///
  /// In en, this message translates to:
  /// **'Profile saved.'**
  String get providerSaved;

  /// No description provided for @providerNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your full name.'**
  String get providerNameRequired;

  /// No description provided for @providerNameTooLong.
  ///
  /// In en, this message translates to:
  /// **'Your name must be 100 characters or fewer.'**
  String get providerNameTooLong;

  /// No description provided for @providerYearsInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a whole number from 0 to 60.'**
  String get providerYearsInvalid;

  /// No description provided for @providerBioTooLong.
  ///
  /// In en, this message translates to:
  /// **'Keep this to 1000 characters or fewer.'**
  String get providerBioTooLong;

  /// No description provided for @providerSubmitForReview.
  ///
  /// In en, this message translates to:
  /// **'Submit for review'**
  String get providerSubmitForReview;

  /// No description provided for @providerSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Profile submitted for review.'**
  String get providerSubmitted;

  /// No description provided for @providerReviewNote.
  ///
  /// In en, this message translates to:
  /// **'Reviewer\'s note: {note}'**
  String providerReviewNote(String note);

  /// No description provided for @verificationDraft.
  ///
  /// In en, this message translates to:
  /// **'Not submitted'**
  String get verificationDraft;

  /// No description provided for @verificationSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Under review'**
  String get verificationSubmitted;

  /// No description provided for @verificationVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get verificationVerified;

  /// No description provided for @verificationRejected.
  ///
  /// In en, this message translates to:
  /// **'Not approved'**
  String get verificationRejected;

  /// No description provided for @verificationDraftHelp.
  ///
  /// In en, this message translates to:
  /// **'Submit your profile so we can review it.'**
  String get verificationDraftHelp;

  /// No description provided for @verificationSubmittedHelp.
  ///
  /// In en, this message translates to:
  /// **'We\'re reviewing your profile. The result will appear here.'**
  String get verificationSubmittedHelp;

  /// No description provided for @verificationVerifiedHelp.
  ///
  /// In en, this message translates to:
  /// **'Your profile is verified. Customers can book you for services that are approved.'**
  String get verificationVerifiedHelp;

  /// No description provided for @verificationRejectedHelp.
  ///
  /// In en, this message translates to:
  /// **'Your profile wasn\'t approved. Update it and submit again.'**
  String get verificationRejectedHelp;

  /// No description provided for @providerMyServices.
  ///
  /// In en, this message translates to:
  /// **'My services'**
  String get providerMyServices;

  /// No description provided for @providerManageServices.
  ///
  /// In en, this message translates to:
  /// **'Manage services'**
  String get providerManageServices;

  /// No description provided for @providerAddServices.
  ///
  /// In en, this message translates to:
  /// **'Add services'**
  String get providerAddServices;

  /// No description provided for @providerServicesSummary.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{You haven\'t applied for any services yet.} =1{1 service application} other{{count} service applications}}'**
  String providerServicesSummary(int count);

  /// No description provided for @providerVerifyFirst.
  ///
  /// In en, this message translates to:
  /// **'Customers can only find you once your profile is verified.'**
  String get providerVerifyFirst;

  /// No description provided for @providerAvailabilityTitle.
  ///
  /// In en, this message translates to:
  /// **'Availability'**
  String get providerAvailabilityTitle;

  /// No description provided for @providerAvailabilityOnline.
  ///
  /// In en, this message translates to:
  /// **'Online — visible for new jobs'**
  String get providerAvailabilityOnline;

  /// No description provided for @providerAvailabilityOffline.
  ///
  /// In en, this message translates to:
  /// **'Offline — not receiving offers'**
  String get providerAvailabilityOffline;

  /// No description provided for @providerAvailabilityHelp.
  ///
  /// In en, this message translates to:
  /// **'Go online to be matched with nearby customers.'**
  String get providerAvailabilityHelp;

  /// No description provided for @providerAvailabilityUpdated.
  ///
  /// In en, this message translates to:
  /// **'Availability updated.'**
  String get providerAvailabilityUpdated;

  /// No description provided for @applicationPending.
  ///
  /// In en, this message translates to:
  /// **'Pending review'**
  String get applicationPending;

  /// No description provided for @applicationApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get applicationApproved;

  /// No description provided for @applicationRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get applicationRejected;

  /// No description provided for @applicationSuspended.
  ///
  /// In en, this message translates to:
  /// **'Suspended'**
  String get applicationSuspended;

  /// No description provided for @applicationPendingHelp.
  ///
  /// In en, this message translates to:
  /// **'We\'re reviewing this application.'**
  String get applicationPendingHelp;

  /// No description provided for @applicationApprovedHelp.
  ///
  /// In en, this message translates to:
  /// **'You\'re approved for this service.'**
  String get applicationApprovedHelp;

  /// No description provided for @applicationRejectedHelp.
  ///
  /// In en, this message translates to:
  /// **'This application wasn\'t approved. You can apply again.'**
  String get applicationRejectedHelp;

  /// No description provided for @applicationSuspendedHelp.
  ///
  /// In en, this message translates to:
  /// **'You can\'t take jobs in this service right now.'**
  String get applicationSuspendedHelp;

  /// No description provided for @providerApplyTitle.
  ///
  /// In en, this message translates to:
  /// **'Apply for services'**
  String get providerApplyTitle;

  /// No description provided for @providerApplyIntro.
  ///
  /// In en, this message translates to:
  /// **'Choose the services you want to offer. Each one is reviewed separately.'**
  String get providerApplyIntro;

  /// No description provided for @providerApplyCity.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get providerApplyCity;

  /// No description provided for @providerApplyNothingLeft.
  ///
  /// In en, this message translates to:
  /// **'You\'ve already applied for every available service.'**
  String get providerApplyNothingLeft;

  /// No description provided for @providerApplyNeedProfile.
  ///
  /// In en, this message translates to:
  /// **'Set up your provider profile before applying for services.'**
  String get providerApplyNeedProfile;

  /// No description provided for @providerApplyButton.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Apply for 1 service} other{Apply for {count} services}}'**
  String providerApplyButton(int count);

  /// No description provided for @providerApplySent.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Application sent.} other{{count} applications sent.}}'**
  String providerApplySent(int count);

  /// No description provided for @providerApplyPartial.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 application couldn\'t be sent.} other{{count} applications couldn\'t be sent.}}'**
  String providerApplyPartial(int count);

  /// No description provided for @providerResubmit.
  ///
  /// In en, this message translates to:
  /// **'Apply again'**
  String get providerResubmit;

  /// No description provided for @providerResubmitted.
  ///
  /// In en, this message translates to:
  /// **'Application sent again.'**
  String get providerResubmitted;

  /// No description provided for @providerWithdraw.
  ///
  /// In en, this message translates to:
  /// **'Withdraw'**
  String get providerWithdraw;

  /// No description provided for @providerWithdrawTitle.
  ///
  /// In en, this message translates to:
  /// **'Withdraw application?'**
  String get providerWithdrawTitle;

  /// No description provided for @providerWithdrawBody.
  ///
  /// In en, this message translates to:
  /// **'Withdraw your application for {service}? You can apply again later.'**
  String providerWithdrawBody(String service);

  /// No description provided for @providerWithdrawn.
  ///
  /// In en, this message translates to:
  /// **'Application withdrawn.'**
  String get providerWithdrawn;

  /// No description provided for @errorAlreadyApplied.
  ///
  /// In en, this message translates to:
  /// **'You\'ve already applied for this service.'**
  String get errorAlreadyApplied;

  /// No description provided for @errorProfileIncomplete.
  ///
  /// In en, this message translates to:
  /// **'Add your name and apply for at least one service before submitting.'**
  String get errorProfileIncomplete;

  /// No description provided for @errorInvalidState.
  ///
  /// In en, this message translates to:
  /// **'That can\'t be done in the current state. Refresh and try again.'**
  String get errorInvalidState;

  /// No description provided for @errorProfileRequired.
  ///
  /// In en, this message translates to:
  /// **'Set up your provider profile first.'**
  String get errorProfileRequired;

  /// No description provided for @errorNotFound.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t find that. It may no longer be available.'**
  String get errorNotFound;

  /// No description provided for @errorValidation.
  ///
  /// In en, this message translates to:
  /// **'Please check the details you entered.'**
  String get errorValidation;

  /// No description provided for @serviceDetailRequest.
  ///
  /// In en, this message translates to:
  /// **'Request this service'**
  String get serviceDetailRequest;

  /// No description provided for @bookingHistoryTitle.
  ///
  /// In en, this message translates to:
  /// **'My bookings'**
  String get bookingHistoryTitle;

  /// No description provided for @bookingHistoryActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get bookingHistoryActive;

  /// No description provided for @bookingHistoryPast.
  ///
  /// In en, this message translates to:
  /// **'Past'**
  String get bookingHistoryPast;

  /// No description provided for @bookingHistoryActiveEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have no active bookings.'**
  String get bookingHistoryActiveEmpty;

  /// No description provided for @bookingHistoryPastEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have no past bookings yet.'**
  String get bookingHistoryPastEmpty;

  /// No description provided for @bookingDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Booking'**
  String get bookingDetailTitle;

  /// No description provided for @bookingCategoryLabel.
  ///
  /// In en, this message translates to:
  /// **'Service'**
  String get bookingCategoryLabel;

  /// No description provided for @bookingCityLabel.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get bookingCityLabel;

  /// No description provided for @bookingPricingLabel.
  ///
  /// In en, this message translates to:
  /// **'Pricing'**
  String get bookingPricingLabel;

  /// No description provided for @bookingAgreedAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Agreed price'**
  String get bookingAgreedAmountLabel;

  /// No description provided for @bookingAmountLkr.
  ///
  /// In en, this message translates to:
  /// **'LKR {amount}'**
  String bookingAmountLkr(String amount);

  /// No description provided for @bookingScheduledLabel.
  ///
  /// In en, this message translates to:
  /// **'Scheduled for'**
  String get bookingScheduledLabel;

  /// No description provided for @bookingAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get bookingAddressLabel;

  /// No description provided for @bookingNotesLabel.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get bookingNotesLabel;

  /// No description provided for @bookingCustomerLabel.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get bookingCustomerLabel;

  /// No description provided for @bookingProviderLabel.
  ///
  /// In en, this message translates to:
  /// **'Provider'**
  String get bookingProviderLabel;

  /// No description provided for @bookingNameUnknown.
  ///
  /// In en, this message translates to:
  /// **'Not given'**
  String get bookingNameUnknown;

  /// No description provided for @bookingTimelineLabel.
  ///
  /// In en, this message translates to:
  /// **'Timeline'**
  String get bookingTimelineLabel;

  /// No description provided for @bookingTimelineEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing has happened yet.'**
  String get bookingTimelineEmpty;

  /// No description provided for @bookingStatusSearching.
  ///
  /// In en, this message translates to:
  /// **'Looking for a provider'**
  String get bookingStatusSearching;

  /// No description provided for @bookingStatusSearchingHelp.
  ///
  /// In en, this message translates to:
  /// **'We\'re showing this request to providers who can do this job.'**
  String get bookingStatusSearchingHelp;

  /// No description provided for @bookingStatusAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get bookingStatusAccepted;

  /// No description provided for @bookingStatusAcceptedHelp.
  ///
  /// In en, this message translates to:
  /// **'A provider has accepted. They\'ll set off when it\'s time.'**
  String get bookingStatusAcceptedHelp;

  /// No description provided for @bookingStatusEnRoute.
  ///
  /// In en, this message translates to:
  /// **'On the way'**
  String get bookingStatusEnRoute;

  /// No description provided for @bookingStatusEnRouteHelp.
  ///
  /// In en, this message translates to:
  /// **'Your provider is on their way.'**
  String get bookingStatusEnRouteHelp;

  /// No description provided for @bookingStatusArrived.
  ///
  /// In en, this message translates to:
  /// **'Arrived'**
  String get bookingStatusArrived;

  /// No description provided for @bookingStatusArrivedHelp.
  ///
  /// In en, this message translates to:
  /// **'Your provider has arrived.'**
  String get bookingStatusArrivedHelp;

  /// No description provided for @bookingStatusInProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get bookingStatusInProgress;

  /// No description provided for @bookingStatusInProgressHelp.
  ///
  /// In en, this message translates to:
  /// **'Work is under way.'**
  String get bookingStatusInProgressHelp;

  /// No description provided for @bookingStatusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get bookingStatusCompleted;

  /// No description provided for @bookingStatusCompletedHelp.
  ///
  /// In en, this message translates to:
  /// **'This job is done.'**
  String get bookingStatusCompletedHelp;

  /// No description provided for @bookingStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get bookingStatusCancelled;

  /// No description provided for @bookingStatusCancelledHelp.
  ///
  /// In en, this message translates to:
  /// **'This booking was cancelled.'**
  String get bookingStatusCancelledHelp;

  /// No description provided for @bookingStatusExpired.
  ///
  /// In en, this message translates to:
  /// **'No provider found'**
  String get bookingStatusExpired;

  /// No description provided for @bookingStatusExpiredHelp.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t find an available provider in time. You can try requesting again.'**
  String get bookingStatusExpiredHelp;

  /// No description provided for @bookingCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel booking'**
  String get bookingCancel;

  /// No description provided for @bookingCancelTitle.
  ///
  /// In en, this message translates to:
  /// **'Cancel this booking?'**
  String get bookingCancelTitle;

  /// No description provided for @bookingCancelBody.
  ///
  /// In en, this message translates to:
  /// **'Let us know why you\'re cancelling.'**
  String get bookingCancelBody;

  /// No description provided for @bookingCancelReasonLabel.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get bookingCancelReasonLabel;

  /// No description provided for @bookingCancelled.
  ///
  /// In en, this message translates to:
  /// **'Booking cancelled.'**
  String get bookingCancelled;

  /// No description provided for @bookingCancelReason.
  ///
  /// In en, this message translates to:
  /// **'Reason: {reason}'**
  String bookingCancelReason(String reason);

  /// No description provided for @bookingRelease.
  ///
  /// In en, this message translates to:
  /// **'Release this job'**
  String get bookingRelease;

  /// No description provided for @bookingReleaseTitle.
  ///
  /// In en, this message translates to:
  /// **'Release this job?'**
  String get bookingReleaseTitle;

  /// No description provided for @bookingReleaseBody.
  ///
  /// In en, this message translates to:
  /// **'It will go back to being an open request for another provider to take.'**
  String get bookingReleaseBody;

  /// No description provided for @bookingReleaseReasonLabel.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get bookingReleaseReasonLabel;

  /// No description provided for @bookingReleased.
  ///
  /// In en, this message translates to:
  /// **'Job released.'**
  String get bookingReleased;

  /// No description provided for @bookingAcceptJob.
  ///
  /// In en, this message translates to:
  /// **'Accept this job'**
  String get bookingAcceptJob;

  /// No description provided for @bookingAcceptedMessage.
  ///
  /// In en, this message translates to:
  /// **'Job accepted.'**
  String get bookingAcceptedMessage;

  /// No description provided for @bookingDeclineOffer.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get bookingDeclineOffer;

  /// No description provided for @bookingOfferDeclined.
  ///
  /// In en, this message translates to:
  /// **'Offer declined.'**
  String get bookingOfferDeclined;

  /// No description provided for @bookingOfferRespondBy.
  ///
  /// In en, this message translates to:
  /// **'Respond by {time}'**
  String bookingOfferRespondBy(String time);

  /// No description provided for @bookingStartEnRoute.
  ///
  /// In en, this message translates to:
  /// **'I\'m on my way'**
  String get bookingStartEnRoute;

  /// No description provided for @bookingEnRouteStarted.
  ///
  /// In en, this message translates to:
  /// **'Marked as on the way.'**
  String get bookingEnRouteStarted;

  /// No description provided for @bookingMarkArrived.
  ///
  /// In en, this message translates to:
  /// **'I\'ve arrived'**
  String get bookingMarkArrived;

  /// No description provided for @bookingArrivedMarked.
  ///
  /// In en, this message translates to:
  /// **'Marked as arrived.'**
  String get bookingArrivedMarked;

  /// No description provided for @bookingStartWork.
  ///
  /// In en, this message translates to:
  /// **'Start work'**
  String get bookingStartWork;

  /// No description provided for @bookingWorkStarted.
  ///
  /// In en, this message translates to:
  /// **'Work started.'**
  String get bookingWorkStarted;

  /// No description provided for @bookingComplete.
  ///
  /// In en, this message translates to:
  /// **'Mark as complete'**
  String get bookingComplete;

  /// No description provided for @bookingCompletedMessage.
  ///
  /// In en, this message translates to:
  /// **'Booking marked as complete.'**
  String get bookingCompletedMessage;

  /// No description provided for @bookingQuotesTitle.
  ///
  /// In en, this message translates to:
  /// **'Quotes'**
  String get bookingQuotesTitle;

  /// No description provided for @bookingNoQuotesYet.
  ///
  /// In en, this message translates to:
  /// **'No quotes yet.'**
  String get bookingNoQuotesYet;

  /// No description provided for @bookingSubmitQuote.
  ///
  /// In en, this message translates to:
  /// **'Submit a quote'**
  String get bookingSubmitQuote;

  /// No description provided for @bookingQuoteAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Your price'**
  String get bookingQuoteAmountLabel;

  /// No description provided for @bookingQuoteAmountInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter an amount greater than zero.'**
  String get bookingQuoteAmountInvalid;

  /// No description provided for @bookingQuoteNoteLabel.
  ///
  /// In en, this message translates to:
  /// **'Note (optional)'**
  String get bookingQuoteNoteLabel;

  /// No description provided for @bookingQuoteSubmit.
  ///
  /// In en, this message translates to:
  /// **'Send quote'**
  String get bookingQuoteSubmit;

  /// No description provided for @bookingQuoteSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Quote sent.'**
  String get bookingQuoteSubmitted;

  /// No description provided for @bookingAcceptQuote.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get bookingAcceptQuote;

  /// No description provided for @bookingRejectQuote.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get bookingRejectQuote;

  /// No description provided for @bookingQuoteAccepted.
  ///
  /// In en, this message translates to:
  /// **'Quote accepted.'**
  String get bookingQuoteAccepted;

  /// No description provided for @bookingQuoteRejected.
  ///
  /// In en, this message translates to:
  /// **'Quote declined.'**
  String get bookingQuoteRejected;

  /// No description provided for @quoteStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get quoteStatusPending;

  /// No description provided for @quoteStatusAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get quoteStatusAccepted;

  /// No description provided for @quoteStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Declined'**
  String get quoteStatusRejected;

  /// No description provided for @providerJobsTitle.
  ///
  /// In en, this message translates to:
  /// **'Jobs'**
  String get providerJobsTitle;

  /// No description provided for @providerJobsOpen.
  ///
  /// In en, this message translates to:
  /// **'Offers'**
  String get providerJobsOpen;

  /// No description provided for @providerJobsAssigned.
  ///
  /// In en, this message translates to:
  /// **'My jobs'**
  String get providerJobsAssigned;

  /// No description provided for @providerJobsOpenEmpty.
  ///
  /// In en, this message translates to:
  /// **'No offers right now. Go online to start receiving them.'**
  String get providerJobsOpenEmpty;

  /// No description provided for @providerJobsAssignedEmpty.
  ///
  /// In en, this message translates to:
  /// **'You have no assigned jobs yet.'**
  String get providerJobsAssignedEmpty;

  /// No description provided for @serviceRequestTitle.
  ///
  /// In en, this message translates to:
  /// **'Request this service'**
  String get serviceRequestTitle;

  /// No description provided for @serviceRequestOnDemand.
  ///
  /// In en, this message translates to:
  /// **'Now'**
  String get serviceRequestOnDemand;

  /// No description provided for @serviceRequestScheduled.
  ///
  /// In en, this message translates to:
  /// **'Schedule'**
  String get serviceRequestScheduled;

  /// No description provided for @serviceRequestPickTime.
  ///
  /// In en, this message translates to:
  /// **'Choose a date and time'**
  String get serviceRequestPickTime;

  /// No description provided for @serviceRequestScheduledTimeInvalid.
  ///
  /// In en, this message translates to:
  /// **'Choose a time in the future.'**
  String get serviceRequestScheduledTimeInvalid;

  /// No description provided for @serviceRequestAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Service address'**
  String get serviceRequestAddressLabel;

  /// No description provided for @serviceRequestAddressHint.
  ///
  /// In en, this message translates to:
  /// **'Where should the provider come?'**
  String get serviceRequestAddressHint;

  /// No description provided for @serviceRequestAddressRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the service address.'**
  String get serviceRequestAddressRequired;

  /// No description provided for @serviceRequestAddressTooLong.
  ///
  /// In en, this message translates to:
  /// **'Keep this to 500 characters or fewer.'**
  String get serviceRequestAddressTooLong;

  /// No description provided for @serviceRequestNotesLabel.
  ///
  /// In en, this message translates to:
  /// **'Notes for the provider (optional)'**
  String get serviceRequestNotesLabel;

  /// No description provided for @serviceRequestNotesHint.
  ///
  /// In en, this message translates to:
  /// **'Anything the provider should know beforehand.'**
  String get serviceRequestNotesHint;

  /// No description provided for @serviceRequestNotesTooLong.
  ///
  /// In en, this message translates to:
  /// **'Keep this to 1000 characters or fewer.'**
  String get serviceRequestNotesTooLong;

  /// No description provided for @serviceRequestSubmit.
  ///
  /// In en, this message translates to:
  /// **'Request service'**
  String get serviceRequestSubmit;

  /// No description provided for @serviceRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Request sent.'**
  String get serviceRequestSent;

  /// No description provided for @serviceRequestUseMyLocation.
  ///
  /// In en, this message translates to:
  /// **'Use my current location'**
  String get serviceRequestUseMyLocation;

  /// No description provided for @serviceRequestLocationSet.
  ///
  /// In en, this message translates to:
  /// **'Precise location added.'**
  String get serviceRequestLocationSet;

  /// No description provided for @serviceRequestClearLocation.
  ///
  /// In en, this message translates to:
  /// **'Remove precise location'**
  String get serviceRequestClearLocation;

  /// No description provided for @locationPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'Location access was not granted.'**
  String get locationPermissionDenied;

  /// No description provided for @locationRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get locationRetry;

  /// No description provided for @locationPermissionDeniedForever.
  ///
  /// In en, this message translates to:
  /// **'Location access is turned off for this app. Turn it on in Settings to use this.'**
  String get locationPermissionDeniedForever;

  /// No description provided for @locationOpenSettings.
  ///
  /// In en, this message translates to:
  /// **'Open settings'**
  String get locationOpenSettings;

  /// No description provided for @locationServiceDisabled.
  ///
  /// In en, this message translates to:
  /// **'Location (GPS) is turned off on this device.'**
  String get locationServiceDisabled;

  /// No description provided for @locationEnableGps.
  ///
  /// In en, this message translates to:
  /// **'Turn on location'**
  String get locationEnableGps;

  /// No description provided for @trackingCustomerLocationTitle.
  ///
  /// In en, this message translates to:
  /// **'Customer location'**
  String get trackingCustomerLocationTitle;

  /// No description provided for @trackingProviderLocationTitle.
  ///
  /// In en, this message translates to:
  /// **'Provider location'**
  String get trackingProviderLocationTitle;

  /// No description provided for @trackingSharingLocation.
  ///
  /// In en, this message translates to:
  /// **'Sharing your location with the customer.'**
  String get trackingSharingLocation;

  /// No description provided for @trackingNotSharing.
  ///
  /// In en, this message translates to:
  /// **'Not sharing your location right now.'**
  String get trackingNotSharing;

  /// No description provided for @trackingWaitingForLocation.
  ///
  /// In en, this message translates to:
  /// **'Waiting for a location update.'**
  String get trackingWaitingForLocation;

  /// No description provided for @trackingNavigate.
  ///
  /// In en, this message translates to:
  /// **'Navigate'**
  String get trackingNavigate;

  /// No description provided for @trackingDistanceAndEta.
  ///
  /// In en, this message translates to:
  /// **'{distanceKm} km away · about {minutes} min'**
  String trackingDistanceAndEta(String distanceKm, String minutes);

  /// No description provided for @trackingLive.
  ///
  /// In en, this message translates to:
  /// **'Live'**
  String get trackingLive;

  /// No description provided for @trackingConnecting.
  ///
  /// In en, this message translates to:
  /// **'Connecting…'**
  String get trackingConnecting;

  /// No description provided for @trackingDisconnected.
  ///
  /// In en, this message translates to:
  /// **'Reconnecting…'**
  String get trackingDisconnected;

  /// No description provided for @errorQuoteNotApplicable.
  ///
  /// In en, this message translates to:
  /// **'That\'s not available for this kind of service.'**
  String get errorQuoteNotApplicable;

  /// No description provided for @errorProviderNotEligible.
  ///
  /// In en, this message translates to:
  /// **'You\'re not approved for this service in this city.'**
  String get errorProviderNotEligible;

  /// No description provided for @errorAlreadyQuoted.
  ///
  /// In en, this message translates to:
  /// **'You\'ve already sent a quote for this booking.'**
  String get errorAlreadyQuoted;

  /// No description provided for @errorPaymentNotReady.
  ///
  /// In en, this message translates to:
  /// **'This booking hasn\'t been completed yet, so there\'s nothing to pay.'**
  String get errorPaymentNotReady;

  /// No description provided for @errorPaymentAlreadyFinal.
  ///
  /// In en, this message translates to:
  /// **'This booking has already been paid.'**
  String get errorPaymentAlreadyFinal;

  /// No description provided for @paymentSectionTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get paymentSectionTitle;

  /// No description provided for @paymentStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Payment pending'**
  String get paymentStatusPending;

  /// No description provided for @paymentStatusSucceeded.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get paymentStatusSucceeded;

  /// No description provided for @paymentStatusFailed.
  ///
  /// In en, this message translates to:
  /// **'Payment failed'**
  String get paymentStatusFailed;

  /// No description provided for @paymentStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Payment cancelled'**
  String get paymentStatusCancelled;

  /// No description provided for @paymentStatusRefunded.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get paymentStatusRefunded;

  /// No description provided for @paymentServiceAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'Service amount'**
  String get paymentServiceAmountLabel;

  /// No description provided for @paymentCommissionLabel.
  ///
  /// In en, this message translates to:
  /// **'Platform fee'**
  String get paymentCommissionLabel;

  /// No description provided for @paymentProviderEarningLabel.
  ///
  /// In en, this message translates to:
  /// **'You earn'**
  String get paymentProviderEarningLabel;

  /// No description provided for @paymentPayNow.
  ///
  /// In en, this message translates to:
  /// **'Pay now'**
  String get paymentPayNow;

  /// No description provided for @paymentRetry.
  ///
  /// In en, this message translates to:
  /// **'Try payment again'**
  String get paymentRetry;

  /// No description provided for @paymentCheckoutOpened.
  ///
  /// In en, this message translates to:
  /// **'Checkout opened in your browser. Come back here once you\'ve paid.'**
  String get paymentCheckoutOpened;

  /// No description provided for @paymentCheckoutOpenFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open the checkout page.'**
  String get paymentCheckoutOpenFailed;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'si', 'ta'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'si':
      return AppLocalizationsSi();
    case 'ta':
      return AppLocalizationsTa();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
