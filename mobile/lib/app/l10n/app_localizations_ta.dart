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

  @override
  String get commonRetry => 'மீண்டும் முயற்சிக்கவும்';

  @override
  String get commonCancel => 'ரத்து செய்';

  @override
  String get servicesSearchHint => 'சேவைகளைத் தேடுங்கள்';

  @override
  String get servicesFilterAll => 'அனைத்தும்';

  @override
  String get servicesEmpty => 'இன்னும் சேவைகள் எதுவும் இல்லை.';

  @override
  String get servicesNoMatch => 'உங்கள் தேடலுக்குப் பொருந்தும் சேவைகள் இல்லை.';

  @override
  String get servicesClearFilters => 'வடிப்பான்களை அழி';

  @override
  String get pricingFixed => 'நிலையான விலை';

  @override
  String get pricingHourly => 'மணிநேரத்துக்கு';

  @override
  String get pricingQuote => 'கேட்டால் விலை மதிப்பீடு';

  @override
  String get pricingFixedHelp => 'வேலைக்கு நிர்ணயிக்கப்பட்ட விலை.';

  @override
  String get pricingHourlyHelp =>
      'சேவை வழங்குநர் வேலைக்குச் செலவிடும் நேரத்துக்கு நீங்கள் செலுத்துவீர்கள்.';

  @override
  String get pricingQuoteHelp =>
      'வேலையைப் புரிந்துகொண்ட பிறகு சேவை வழங்குநர் விலையைத் தெரிவிப்பார்.';

  @override
  String get serviceDetailPricing => 'விலை நிர்ணயம் எவ்வாறு செயல்படுகிறது';

  @override
  String get serviceDetailAvailableIn => 'கிடைக்கும் நகரங்கள்';

  @override
  String serviceDetailProviders(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'அங்கீகரிக்கப்பட்ட சேவை வழங்குநர்கள் $count',
      one: 'அங்கீகரிக்கப்பட்ட சேவை வழங்குநர் 1',
      zero: 'அங்கீகரிக்கப்பட்ட சேவை வழங்குநர்கள் இன்னும் இல்லை',
    );
    return '$_temp0';
  }

  @override
  String get serviceDetailNotAvailable => 'இந்தச் சேவை இப்போது கிடைக்கவில்லை.';

  @override
  String get serviceDetailOffer => 'இந்தச் சேவையை வழங்குங்கள்';

  @override
  String get homeProviderArea => 'சேவை வழங்குநர் பகுதி';

  @override
  String get providerAreaTitle => 'சேவை வழங்குநர் பகுதி';

  @override
  String get providerIntroTitle => 'உங்கள் திறமையால் வருமானம் ஈட்டுங்கள்';

  @override
  String get providerIntroBody =>
      'சேவை வழங்குநர் சுயவிவரத்தை உருவாக்கி, நீங்கள் வழங்கும் சேவைகளைத் தேர்ந்தெடுங்கள். உங்கள் விண்ணப்பத்தை நாங்கள் மதிப்பாய்வு செய்வோம்.';

  @override
  String get providerSetupProfile => 'சேவை வழங்குநர் சுயவிவரத்தை அமைக்கவும்';

  @override
  String get providerEditProfile => 'சுயவிவரத்தைத் திருத்து';

  @override
  String get providerProfileTitle => 'சேவை வழங்குநர் சுயவிவரம்';

  @override
  String get providerFullNameLabel => 'முழுப் பெயர்';

  @override
  String get providerYearsLabel => 'அனுபவ ஆண்டுகள்';

  @override
  String get providerBioLabel => 'உங்களைப் பற்றி';

  @override
  String get providerBioHint =>
      'உங்கள் திறமைகளையும் நீங்கள் செய்யும் வேலையையும் விவரிக்கவும்.';

  @override
  String get providerSave => 'சுயவிவரத்தைச் சேமி';

  @override
  String get providerSaved => 'சுயவிவரம் சேமிக்கப்பட்டது.';

  @override
  String get providerNameRequired => 'உங்கள் முழுப் பெயரை உள்ளிடவும்.';

  @override
  String get providerNameTooLong =>
      'பெயர் 100 எழுத்துகளுக்குள் இருக்க வேண்டும்.';

  @override
  String get providerYearsInvalid => '0 முதல் 60 வரை முழு எண்ணை உள்ளிடவும்.';

  @override
  String get providerBioTooLong => '1000 எழுத்துகளுக்குள் வைத்திருங்கள்.';

  @override
  String get providerSubmitForReview => 'மதிப்பாய்வுக்குச் சமர்ப்பிக்கவும்';

  @override
  String get providerSubmitted =>
      'சுயவிவரம் மதிப்பாய்வுக்குச் சமர்ப்பிக்கப்பட்டது.';

  @override
  String providerReviewNote(String note) {
    return 'மதிப்பாய்வாளர் குறிப்பு: $note';
  }

  @override
  String get verificationDraft => 'சமர்ப்பிக்கப்படவில்லை';

  @override
  String get verificationSubmitted => 'மதிப்பாய்வில் உள்ளது';

  @override
  String get verificationVerified => 'சரிபார்க்கப்பட்டது';

  @override
  String get verificationRejected => 'அங்கீகரிக்கப்படவில்லை';

  @override
  String get verificationDraftHelp =>
      'நாங்கள் மதிப்பாய்வு செய்ய உங்கள் சுயவிவரத்தைச் சமர்ப்பிக்கவும்.';

  @override
  String get verificationSubmittedHelp =>
      'உங்கள் சுயவிவரத்தை மதிப்பாய்வு செய்கிறோம். முடிவு இங்கே தோன்றும்.';

  @override
  String get verificationVerifiedHelp =>
      'உங்கள் சுயவிவரம் சரிபார்க்கப்பட்டது. அங்கீகரிக்கப்பட்ட சேவைகளுக்கு வாடிக்கையாளர்கள் உங்களை முன்பதிவு செய்யலாம்.';

  @override
  String get verificationRejectedHelp =>
      'உங்கள் சுயவிவரம் அங்கீகரிக்கப்படவில்லை. அதைப் புதுப்பித்து மீண்டும் சமர்ப்பிக்கவும்.';

  @override
  String get providerMyServices => 'என் சேவைகள்';

  @override
  String get providerManageServices => 'சேவைகளை நிர்வகி';

  @override
  String get providerAddServices => 'சேவைகளைச் சேர்';

  @override
  String providerServicesSummary(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count சேவை விண்ணப்பங்கள்',
      one: '1 சேவை விண்ணப்பம்',
      zero: 'நீங்கள் இன்னும் எந்தச் சேவைக்கும் விண்ணப்பிக்கவில்லை.',
    );
    return '$_temp0';
  }

  @override
  String get providerVerifyFirst =>
      'உங்கள் சுயவிவரம் சரிபார்க்கப்பட்ட பிறகே வாடிக்கையாளர்கள் உங்களைக் கண்டறிய முடியும்.';

  @override
  String get applicationPending => 'மதிப்பாய்வுக்குக் காத்திருக்கிறது';

  @override
  String get applicationApproved => 'அங்கீகரிக்கப்பட்டது';

  @override
  String get applicationRejected => 'நிராகரிக்கப்பட்டது';

  @override
  String get applicationSuspended => 'இடைநிறுத்தப்பட்டது';

  @override
  String get applicationPendingHelp =>
      'இந்த விண்ணப்பத்தை மதிப்பாய்வு செய்கிறோம்.';

  @override
  String get applicationApprovedHelp =>
      'இந்தச் சேவைக்கு நீங்கள் அங்கீகரிக்கப்பட்டுள்ளீர்கள்.';

  @override
  String get applicationRejectedHelp =>
      'இந்த விண்ணப்பம் அங்கீகரிக்கப்படவில்லை. மீண்டும் விண்ணப்பிக்கலாம்.';

  @override
  String get applicationSuspendedHelp =>
      'இந்தச் சேவையில் இப்போது நீங்கள் வேலைகளை ஏற்க முடியாது.';

  @override
  String get providerApplyTitle => 'சேவைகளுக்கு விண்ணப்பிக்கவும்';

  @override
  String get providerApplyIntro =>
      'நீங்கள் வழங்க விரும்பும் சேவைகளைத் தேர்ந்தெடுங்கள். ஒவ்வொன்றும் தனித்தனியாக மதிப்பாய்வு செய்யப்படும்.';

  @override
  String get providerApplyCity => 'நகரம்';

  @override
  String get providerApplyNothingLeft =>
      'கிடைக்கும் அனைத்துச் சேவைகளுக்கும் நீங்கள் ஏற்கெனவே விண்ணப்பித்துவிட்டீர்கள்.';

  @override
  String get providerApplyNeedProfile =>
      'சேவைகளுக்கு விண்ணப்பிக்கும் முன் உங்கள் சேவை வழங்குநர் சுயவிவரத்தை அமைக்கவும்.';

  @override
  String providerApplyButton(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count சேவைகளுக்கு விண்ணப்பி',
      one: '1 சேவைக்கு விண்ணப்பி',
    );
    return '$_temp0';
  }

  @override
  String providerApplySent(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count விண்ணப்பங்கள் அனுப்பப்பட்டன.',
      one: 'விண்ணப்பம் அனுப்பப்பட்டது.',
    );
    return '$_temp0';
  }

  @override
  String providerApplyPartial(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count விண்ணப்பங்களை அனுப்ப முடியவில்லை.',
      one: '1 விண்ணப்பத்தை அனுப்ப முடியவில்லை.',
    );
    return '$_temp0';
  }

  @override
  String get providerResubmit => 'மீண்டும் விண்ணப்பி';

  @override
  String get providerResubmitted => 'விண்ணப்பம் மீண்டும் அனுப்பப்பட்டது.';

  @override
  String get providerWithdraw => 'விண்ணப்பத்தைத் திரும்பப் பெறு';

  @override
  String get providerWithdrawTitle => 'விண்ணப்பத்தைத் திரும்பப் பெறவா?';

  @override
  String providerWithdrawBody(String service) {
    return '$service க்கான உங்கள் விண்ணப்பத்தைத் திரும்பப் பெறவா? பின்னர் மீண்டும் விண்ணப்பிக்கலாம்.';
  }

  @override
  String get providerWithdrawn => 'விண்ணப்பம் திரும்பப் பெறப்பட்டது.';

  @override
  String get errorAlreadyApplied =>
      'இந்தச் சேவைக்கு நீங்கள் ஏற்கெனவே விண்ணப்பித்துவிட்டீர்கள்.';

  @override
  String get errorProfileIncomplete =>
      'சமர்ப்பிக்கும் முன் உங்கள் பெயரைச் சேர்த்து, குறைந்தது ஒரு சேவைக்கு விண்ணப்பிக்கவும்.';

  @override
  String get errorInvalidState =>
      'தற்போதைய நிலையில் அதைச் செய்ய முடியாது. புதுப்பித்து மீண்டும் முயற்சிக்கவும்.';

  @override
  String get errorProfileRequired =>
      'முதலில் உங்கள் சேவை வழங்குநர் சுயவிவரத்தை அமைக்கவும்.';

  @override
  String get errorNotFound =>
      'அதைக் கண்டறிய முடியவில்லை. அது இனி கிடைக்காமல் இருக்கலாம்.';

  @override
  String get errorValidation => 'நீங்கள் உள்ளிட்ட விவரங்களைச் சரிபார்க்கவும்.';

  @override
  String get serviceDetailRequest => 'இந்தச் சேவையைக் கோருங்கள்';

  @override
  String get bookingHistoryTitle => 'என் முன்பதிவுகள்';

  @override
  String get bookingHistoryActive => 'செயலில் உள்ளவை';

  @override
  String get bookingHistoryPast => 'கடந்தவை';

  @override
  String get bookingHistoryActiveEmpty =>
      'உங்களுக்கு செயலில் உள்ள முன்பதிவுகள் இல்லை.';

  @override
  String get bookingHistoryPastEmpty =>
      'உங்களுக்கு இன்னும் கடந்த முன்பதிவுகள் இல்லை.';

  @override
  String get bookingDetailTitle => 'முன்பதிவு';

  @override
  String get bookingCategoryLabel => 'சேவை';

  @override
  String get bookingCityLabel => 'நகரம்';

  @override
  String get bookingPricingLabel => 'விலை நிர்ணயம்';

  @override
  String get bookingAgreedAmountLabel => 'ஒப்புக்கொண்ட விலை';

  @override
  String bookingAmountLkr(String amount) {
    return 'ரூ. $amount';
  }

  @override
  String get bookingScheduledLabel => 'திட்டமிடப்பட்ட நேரம்';

  @override
  String get bookingAddressLabel => 'முகவரி';

  @override
  String get bookingNotesLabel => 'குறிப்புகள்';

  @override
  String get bookingCustomerLabel => 'வாடிக்கையாளர்';

  @override
  String get bookingProviderLabel => 'சேவை வழங்குநர்';

  @override
  String get bookingNameUnknown => 'குறிப்பிடப்படவில்லை';

  @override
  String get bookingTimelineLabel => 'காலவரிசை';

  @override
  String get bookingTimelineEmpty => 'இன்னும் எதுவும் நடக்கவில்லை.';

  @override
  String get bookingStatusSearching => 'சேவை வழங்குநரைத் தேடுகிறது';

  @override
  String get bookingStatusSearchingHelp =>
      'இந்த வேலையைச் செய்யக்கூடிய சேவை வழங்குநர்களுக்கு இந்த வேண்டுகோளைக் காட்டுகிறோம்.';

  @override
  String get bookingStatusAccepted => 'ஏற்கப்பட்டது';

  @override
  String get bookingStatusAcceptedHelp =>
      'ஒரு சேவை வழங்குநர் ஏற்றுக்கொண்டார். நேரம் வரும்போது அவர்கள் புறப்படுவார்கள்.';

  @override
  String get bookingStatusEnRoute => 'வழியில் உள்ளார்';

  @override
  String get bookingStatusEnRouteHelp =>
      'உங்கள் சேவை வழங்குநர் வழியில் உள்ளார்.';

  @override
  String get bookingStatusArrived => 'வந்துவிட்டார்';

  @override
  String get bookingStatusArrivedHelp => 'உங்கள் சேவை வழங்குநர் வந்துவிட்டார்.';

  @override
  String get bookingStatusInProgress => 'நடைபெறுகிறது';

  @override
  String get bookingStatusInProgressHelp => 'வேலை நடைபெறுகிறது.';

  @override
  String get bookingStatusCompleted => 'முடிந்தது';

  @override
  String get bookingStatusCompletedHelp => 'இந்த வேலை முடிந்தது.';

  @override
  String get bookingStatusCancelled => 'ரத்து செய்யப்பட்டது';

  @override
  String get bookingStatusCancelledHelp =>
      'இந்த முன்பதிவு ரத்து செய்யப்பட்டது.';

  @override
  String get bookingCancel => 'முன்பதிவை ரத்து செய்';

  @override
  String get bookingCancelTitle => 'இந்த முன்பதிவை ரத்து செய்யவா?';

  @override
  String get bookingCancelBody =>
      'நீங்கள் ரத்து செய்வது ஏன் என்று எங்களுக்குத் தெரியப்படுத்துங்கள்.';

  @override
  String get bookingCancelReasonLabel => 'காரணம்';

  @override
  String get bookingCancelled => 'முன்பதிவு ரத்து செய்யப்பட்டது.';

  @override
  String bookingCancelReason(String reason) {
    return 'காரணம்: $reason';
  }

  @override
  String get bookingRelease => 'இந்த வேலையை விடுவி';

  @override
  String get bookingReleaseTitle => 'இந்த வேலையை விடுவிக்கவா?';

  @override
  String get bookingReleaseBody =>
      'இது மற்றொரு சேவை வழங்குநர் எடுக்கக்கூடிய திறந்த வேண்டுகோளாக மீண்டும் மாறும்.';

  @override
  String get bookingReleaseReasonLabel => 'காரணம்';

  @override
  String get bookingReleased => 'வேலை விடுவிக்கப்பட்டது.';

  @override
  String get bookingAcceptJob => 'இந்த வேலையை ஏற்கவும்';

  @override
  String get bookingAcceptedMessage => 'வேலை ஏற்கப்பட்டது.';

  @override
  String get bookingStartEnRoute => 'நான் வழியில் இருக்கிறேன்';

  @override
  String get bookingEnRouteStarted => 'வழியில் என குறிக்கப்பட்டது.';

  @override
  String get bookingMarkArrived => 'நான் வந்துவிட்டேன்';

  @override
  String get bookingArrivedMarked => 'வந்துவிட்டதாக குறிக்கப்பட்டது.';

  @override
  String get bookingStartWork => 'வேலையைத் தொடங்கு';

  @override
  String get bookingWorkStarted => 'வேலை தொடங்கியது.';

  @override
  String get bookingComplete => 'முடிந்தது என குறி';

  @override
  String get bookingCompletedMessage => 'முன்பதிவு முடிந்ததாக குறிக்கப்பட்டது.';

  @override
  String get bookingQuotesTitle => 'விலை மதிப்பீடுகள்';

  @override
  String get bookingNoQuotesYet => 'இன்னும் விலை மதிப்பீடுகள் இல்லை.';

  @override
  String get bookingSubmitQuote => 'விலை மதிப்பீடு அனுப்பு';

  @override
  String get bookingQuoteAmountLabel => 'உங்கள் விலை';

  @override
  String get bookingQuoteAmountInvalid =>
      'பூஜ்ஜியத்தை விட அதிகமான தொகையை உள்ளிடவும்.';

  @override
  String get bookingQuoteNoteLabel => 'குறிப்பு (விருப்பத்தேர்வு)';

  @override
  String get bookingQuoteSubmit => 'மதிப்பீட்டை அனுப்பு';

  @override
  String get bookingQuoteSubmitted => 'மதிப்பீடு அனுப்பப்பட்டது.';

  @override
  String get bookingAcceptQuote => 'ஏற்கவும்';

  @override
  String get bookingRejectQuote => 'நிராகரி';

  @override
  String get bookingQuoteAccepted => 'மதிப்பீடு ஏற்கப்பட்டது.';

  @override
  String get bookingQuoteRejected => 'மதிப்பீடு நிராகரிக்கப்பட்டது.';

  @override
  String get quoteStatusPending => 'நிலுவையில்';

  @override
  String get quoteStatusAccepted => 'ஏற்கப்பட்டது';

  @override
  String get quoteStatusRejected => 'நிராகரிக்கப்பட்டது';

  @override
  String get providerJobsTitle => 'வேலைகள்';

  @override
  String get providerJobsOpen => 'திறந்த வேண்டுகோள்கள்';

  @override
  String get providerJobsAssigned => 'என் வேலைகள்';

  @override
  String get providerJobsOpenEmpty =>
      'உங்கள் சேவைகளுக்கு தற்போது திறந்த வேண்டுகோள்கள் இல்லை.';

  @override
  String get providerJobsAssignedEmpty =>
      'உங்களுக்கு இன்னும் ஒதுக்கப்பட்ட வேலைகள் இல்லை.';

  @override
  String get serviceRequestTitle => 'இந்தச் சேவையைக் கோருங்கள்';

  @override
  String get serviceRequestOnDemand => 'இப்போது';

  @override
  String get serviceRequestScheduled => 'திட்டமிடு';

  @override
  String get serviceRequestPickTime =>
      'தேதி மற்றும் நேரத்தைத் தேர்ந்தெடுக்கவும்';

  @override
  String get serviceRequestScheduledTimeInvalid =>
      'எதிர்கால நேரத்தைத் தேர்ந்தெடுக்கவும்.';

  @override
  String get serviceRequestAddressLabel => 'சேவை முகவரி';

  @override
  String get serviceRequestAddressHint => 'சேவை வழங்குநர் எங்கு வர வேண்டும்?';

  @override
  String get serviceRequestAddressRequired => 'சேவை முகவரியை உள்ளிடவும்.';

  @override
  String get serviceRequestAddressTooLong =>
      '500 எழுத்துகளுக்குள் வைத்திருங்கள்.';

  @override
  String get serviceRequestNotesLabel =>
      'சேவை வழங்குநருக்கான குறிப்புகள் (விருப்பத்தேர்வு)';

  @override
  String get serviceRequestNotesHint =>
      'சேவை வழங்குநர் முன்கூட்டியே தெரிந்துகொள்ள வேண்டிய எதுவும்.';

  @override
  String get serviceRequestNotesTooLong =>
      '1000 எழுத்துகளுக்குள் வைத்திருங்கள்.';

  @override
  String get serviceRequestSubmit => 'சேவையைக் கோரவும்';

  @override
  String get serviceRequestSent => 'வேண்டுகோள் அனுப்பப்பட்டது.';

  @override
  String get errorQuoteNotApplicable => 'இந்த வகை சேவைக்கு அது கிடைக்காது.';

  @override
  String get errorProviderNotEligible =>
      'இந்த நகரத்தில் இந்தச் சேவைக்கு நீங்கள் அங்கீகரிக்கப்படவில்லை.';

  @override
  String get errorAlreadyQuoted =>
      'இந்த முன்பதிவுக்கு நீங்கள் ஏற்கெனவே ஒரு மதிப்பீட்டை அனுப்பியுள்ளீர்கள்.';
}
