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

  @override
  String get commonRetry => 'නැවත උත්සාහ කරන්න';

  @override
  String get commonCancel => 'අවලංගු කරන්න';

  @override
  String get servicesSearchHint => 'සේවා සොයන්න';

  @override
  String get servicesFilterAll => 'සියල්ල';

  @override
  String get servicesEmpty => 'තවම සේවා නොමැත.';

  @override
  String get servicesNoMatch => 'ඔබේ සෙවුමට ගැළපෙන සේවා නොමැත.';

  @override
  String get servicesClearFilters => 'පෙරහන් ඉවත් කරන්න';

  @override
  String get pricingFixed => 'ස්ථාවර මිල';

  @override
  String get pricingHourly => 'පැයකට';

  @override
  String get pricingQuote => 'ඉල්ලුවොත් මිල ගණන්';

  @override
  String get pricingFixedHelp => 'වැඩයට නියමිත මිලක්.';

  @override
  String get pricingHourlyHelp => 'සේවා සපයන්නා වැඩයට ගත කරන කාලයට ඔබ ගෙවයි.';

  @override
  String get pricingQuoteHelp =>
      'වැඩය තේරුම් ගත් පසු සේවා සපයන්නා මිල ගණන් කියයි.';

  @override
  String get serviceDetailPricing => 'මිල ගණන් ක්‍රියා කරන ආකාරය';

  @override
  String get serviceDetailAvailableIn => 'ලබා ගත හැකි නගර';

  @override
  String serviceDetailProviders(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'අනුමත සේවා සපයන්නන් $count',
      one: 'අනුමත සේවා සපයන්නෙක් 1',
      zero: 'අනුමත සේවා සපයන්නන් තවම නැත',
    );
    return '$_temp0';
  }

  @override
  String get serviceDetailNotAvailable => 'මෙම සේවාව දැනට නොමැත.';

  @override
  String get serviceDetailOffer => 'මෙම සේවාව ලබා දෙන්න';

  @override
  String get homeProviderArea => 'සේවා සපයන්නන්ගේ කොටස';

  @override
  String get providerAreaTitle => 'සේවා සපයන්නන්ගේ කොටස';

  @override
  String get providerIntroTitle => 'ඔබේ නිපුණතාවෙන් ආදායම් උපයන්න';

  @override
  String get providerIntroBody =>
      'සේවා සපයන්නෙකු ලෙස පැතිකඩක් සාදා, ඔබ ලබා දෙන සේවා තෝරන්න. අපි ඔබේ ඉල්ලුම්පත සමාලෝචනය කරන්නෙමු.';

  @override
  String get providerSetupProfile => 'සේවා සපයන්නෙකු ලෙස පැතිකඩ සකසන්න';

  @override
  String get providerEditProfile => 'පැතිකඩ සංස්කරණය';

  @override
  String get providerProfileTitle => 'සේවා සපයන්නාගේ පැතිකඩ';

  @override
  String get providerFullNameLabel => 'සම්පූර්ණ නම';

  @override
  String get providerYearsLabel => 'පළපුරුදු වසර ගණන';

  @override
  String get providerBioLabel => 'ඔබ ගැන';

  @override
  String get providerBioHint => 'ඔබේ හැකියාවන් සහ ඔබ කරන වැඩ විස්තර කරන්න.';

  @override
  String get providerSave => 'පැතිකඩ සුරකින්න';

  @override
  String get providerSaved => 'පැතිකඩ සුරැකිණි.';

  @override
  String get providerNameRequired => 'ඔබේ සම්පූර්ණ නම ඇතුළත් කරන්න.';

  @override
  String get providerNameTooLong => 'නම අක්ෂර 100ක් හෝ ඊට අඩු විය යුතුය.';

  @override
  String get providerYearsInvalid =>
      '0 සිට 60 දක්වා පූර්ණ සංඛ්‍යාවක් ඇතුළත් කරන්න.';

  @override
  String get providerBioTooLong => 'අක්ෂර 1000ක් හෝ ඊට අඩු කරන්න.';

  @override
  String get providerSubmitForReview => 'සමාලෝචනයට ඉදිරිපත් කරන්න';

  @override
  String get providerSubmitted => 'පැතිකඩ සමාලෝචනයට ඉදිරිපත් කරන ලදී.';

  @override
  String providerReviewNote(String note) {
    return 'සමාලෝචකයාගේ සටහන: $note';
  }

  @override
  String get verificationDraft => 'ඉදිරිපත් කර නැත';

  @override
  String get verificationSubmitted => 'සමාලෝචනය වෙමින්';

  @override
  String get verificationVerified => 'තහවුරු කරන ලදී';

  @override
  String get verificationRejected => 'අනුමත නොකළා';

  @override
  String get verificationDraftHelp =>
      'අපට සමාලෝචනය කළ හැකි වන පරිදි ඔබේ පැතිකඩ ඉදිරිපත් කරන්න.';

  @override
  String get verificationSubmittedHelp =>
      'අපි ඔබේ පැතිකඩ සමාලෝචනය කරමින් සිටිමු. ප්‍රතිඵලය මෙහි පෙන්වයි.';

  @override
  String get verificationVerifiedHelp =>
      'ඔබේ පැතිකඩ තහවුරු කර ඇත. අනුමත සේවා සඳහා පාරිභෝගිකයන්ට ඔබව වෙන්කරවා ගත හැක.';

  @override
  String get verificationRejectedHelp =>
      'ඔබේ පැතිකඩ අනුමත නොකළා. එය යාවත්කාලීන කර නැවත ඉදිරිපත් කරන්න.';

  @override
  String get providerMyServices => 'මගේ සේවා';

  @override
  String get providerManageServices => 'සේවා කළමනාකරණය';

  @override
  String get providerAddServices => 'සේවා එක් කරන්න';

  @override
  String providerServicesSummary(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'සේවා ඉල්ලුම්පත් $count',
      one: 'සේවා ඉල්ලුම්පත් 1',
      zero: 'ඔබ තවම කිසිදු සේවාවකට ඉල්ලුම් කර නැත.',
    );
    return '$_temp0';
  }

  @override
  String get providerVerifyFirst =>
      'ඔබේ පැතිකඩ තහවුරු කළ පසු පමණක් පාරිභෝගිකයන්ට ඔබව සොයාගත හැක.';

  @override
  String get providerAvailabilityTitle => 'ලබා ගත හැකි බව';

  @override
  String get providerAvailabilityOnline =>
      'සබැඳිව — නව රැකියා සඳහා දෘශ්‍යමානයි';

  @override
  String get providerAvailabilityOffline => 'නොබැඳිව — දීමනා ලැබෙන්නේ නැත';

  @override
  String get providerAvailabilityHelp =>
      'ආසන්න පාරිභෝගිකයන් සමඟ ගැළපීමට සබැඳි වන්න.';

  @override
  String get providerAvailabilityUpdated =>
      'ලබා ගත හැකි බව යාවත්කාලීන කරන ලදී.';

  @override
  String get applicationPending => 'සමාලෝචනය බලාපොරොත්තුවෙන්';

  @override
  String get applicationApproved => 'අනුමතයි';

  @override
  String get applicationRejected => 'ප්‍රතික්ෂේප කළා';

  @override
  String get applicationSuspended => 'අත්හිටුවා ඇත';

  @override
  String get applicationPendingHelp =>
      'අපි මෙම ඉල්ලුම්පත සමාලෝචනය කරමින් සිටිමු.';

  @override
  String get applicationApprovedHelp => 'ඔබ මෙම සේවාව සඳහා අනුමතයි.';

  @override
  String get applicationRejectedHelp =>
      'මෙම ඉල්ලුම්පත අනුමත නොකළා. ඔබට නැවත ඉල්ලුම් කළ හැක.';

  @override
  String get applicationSuspendedHelp =>
      'මෙම සේවාවේ රැකියා ගැනීමට ඔබට දැනට නොහැක.';

  @override
  String get providerApplyTitle => 'සේවා සඳහා ඉල්ලුම් කරන්න';

  @override
  String get providerApplyIntro =>
      'ඔබ ලබා දීමට කැමති සේවා තෝරන්න. ඒ සෑම එකක්ම වෙන වෙනම සමාලෝචනය කෙරේ.';

  @override
  String get providerApplyCity => 'නගරය';

  @override
  String get providerApplyNothingLeft =>
      'ලබා ගත හැකි සියලු සේවා සඳහා ඔබ දැනටමත් ඉල්ලුම් කර ඇත.';

  @override
  String get providerApplyNeedProfile =>
      'සේවා සඳහා ඉල්ලුම් කිරීමට පෙර ඔබේ සේවා සපයන්නාගේ පැතිකඩ සකසන්න.';

  @override
  String providerApplyButton(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'සේවා $countකට ඉල්ලුම් කරන්න',
      one: 'සේවා 1කට ඉල්ලුම් කරන්න',
    );
    return '$_temp0';
  }

  @override
  String providerApplySent(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ඉල්ලුම්පත් $countක් යැව්වා.',
      one: 'ඉල්ලුම්පත යැව්වා.',
    );
    return '$_temp0';
  }

  @override
  String providerApplyPartial(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ඉල්ලුම්පත් $countක් යැවීමට නොහැකි විය.',
      one: 'ඉල්ලුම්පත් 1ක් යැවීමට නොහැකි විය.',
    );
    return '$_temp0';
  }

  @override
  String get providerResubmit => 'නැවත ඉල්ලුම් කරන්න';

  @override
  String get providerResubmitted => 'ඉල්ලුම්පත නැවත යැව්වා.';

  @override
  String get providerWithdraw => 'ඉල්ලුම්පත ඉවත් කරන්න';

  @override
  String get providerWithdrawTitle => 'ඉල්ලුම්පත ඉවත් කරන්නද?';

  @override
  String providerWithdrawBody(String service) {
    return '$service සඳහා ඔබේ ඉල්ලුම්පත ඉවත් කරන්නද? ඔබට පසුව නැවත ඉල්ලුම් කළ හැක.';
  }

  @override
  String get providerWithdrawn => 'ඉල්ලුම්පත ඉවත් කළා.';

  @override
  String get errorAlreadyApplied => 'ඔබ දැනටමත් මෙම සේවාව සඳහා ඉල්ලුම් කර ඇත.';

  @override
  String get errorProfileIncomplete =>
      'ඉදිරිපත් කිරීමට පෙර ඔබේ නම එක් කර අවම වශයෙන් එක් සේවාවකට ඉල්ලුම් කරන්න.';

  @override
  String get errorInvalidState =>
      'වත්මන් තත්ත්වයේදී එය කළ නොහැක. නැවුම් කර නැවත උත්සාහ කරන්න.';

  @override
  String get errorProfileRequired => 'පළමුව ඔබේ සේවා සපයන්නාගේ පැතිකඩ සකසන්න.';

  @override
  String get errorNotFound =>
      'එය සොයා ගැනීමට නොහැකි විය. එය තවදුරටත් නොතිබිය හැක.';

  @override
  String get errorValidation => 'කරුණාකර ඔබ ඇතුළත් කළ තොරතුරු පරීක්ෂා කරන්න.';

  @override
  String get serviceDetailRequest => 'මෙම සේවාව ඉල්ලන්න';

  @override
  String get bookingHistoryTitle => 'මගේ වෙන්කිරීම්';

  @override
  String get bookingHistoryActive => 'සක්‍රීය';

  @override
  String get bookingHistoryPast => 'අතීත';

  @override
  String get bookingHistoryActiveEmpty => 'ඔබට සක්‍රීය වෙන්කිරීම් නොමැත.';

  @override
  String get bookingHistoryPastEmpty => 'ඔබට තවම අතීත වෙන්කිරීම් නොමැත.';

  @override
  String get bookingDetailTitle => 'වෙන්කිරීම';

  @override
  String get bookingCategoryLabel => 'සේවාව';

  @override
  String get bookingCityLabel => 'නගරය';

  @override
  String get bookingPricingLabel => 'මිල ගණන්';

  @override
  String get bookingAgreedAmountLabel => 'එකඟ වූ මිල';

  @override
  String bookingAmountLkr(String amount) {
    return 'රු. $amount';
  }

  @override
  String get bookingScheduledLabel => 'නියමිත වේලාව';

  @override
  String get bookingAddressLabel => 'ලිපිනය';

  @override
  String get bookingNotesLabel => 'සටහන්';

  @override
  String get bookingCustomerLabel => 'පාරිභෝගිකයා';

  @override
  String get bookingProviderLabel => 'සේවා සපයන්නා';

  @override
  String get bookingNameUnknown => 'සඳහන් කර නැත';

  @override
  String get bookingTimelineLabel => 'කාල රේඛාව';

  @override
  String get bookingTimelineEmpty => 'තවම කිසිවක් සිදු වී නැත.';

  @override
  String get bookingStatusSearching => 'සේවා සපයන්නෙකු සොයමින්';

  @override
  String get bookingStatusSearchingHelp =>
      'මෙම වැඩය කළ හැකි සේවා සපයන්නන්ට අපි මෙම ඉල්ලීම පෙන්වමින් සිටිමු.';

  @override
  String get bookingStatusAccepted => 'අනුමතයි';

  @override
  String get bookingStatusAcceptedHelp =>
      'සේවා සපයන්නෙකු එය පිළිගෙන ඇත. වේලාව එළඹෙන විට ඔවුන් පිටත් වනු ඇත.';

  @override
  String get bookingStatusEnRoute => 'මාර්ගයේ';

  @override
  String get bookingStatusEnRouteHelp => 'ඔබේ සේවා සපයන්නා මාර්ගයේ පවතී.';

  @override
  String get bookingStatusArrived => 'පැමිණ ඇත';

  @override
  String get bookingStatusArrivedHelp => 'ඔබේ සේවා සපයන්නා පැමිණ ඇත.';

  @override
  String get bookingStatusInProgress => 'සිදු වෙමින්';

  @override
  String get bookingStatusInProgressHelp => 'වැඩය සිදු වෙමින් පවතී.';

  @override
  String get bookingStatusCompleted => 'සම්පූර්ණයි';

  @override
  String get bookingStatusCompletedHelp => 'මෙම කාර්යය අවසන් වී ඇත.';

  @override
  String get bookingStatusCancelled => 'අවලංගු කරන ලදී';

  @override
  String get bookingStatusCancelledHelp => 'මෙම වෙන්කිරීම අවලංගු කරන ලදී.';

  @override
  String get bookingStatusExpired => 'සේවා සපයන්නෙකු හමු නොවීය';

  @override
  String get bookingStatusExpiredHelp =>
      'නියමිත වේලාවට ලබා ගත හැකි සේවා සපයන්නෙකු අපට හමු නොවීය. ඔබට නැවත ඉල්ලීමක් කළ හැක.';

  @override
  String get bookingCancel => 'වෙන්කිරීම අවලංගු කරන්න';

  @override
  String get bookingCancelTitle => 'මෙම වෙන්කිරීම අවලංගු කරන්නද?';

  @override
  String get bookingCancelBody => 'ඔබ අවලංගු කරන්නේ ඇයිද යන්න අපට කියන්න.';

  @override
  String get bookingCancelReasonLabel => 'හේතුව';

  @override
  String get bookingCancelled => 'වෙන්කිරීම අවලංගු කරන ලදී.';

  @override
  String bookingCancelReason(String reason) {
    return 'හේතුව: $reason';
  }

  @override
  String get bookingRelease => 'මෙම කාර්යය මුදාහරින්න';

  @override
  String get bookingReleaseTitle => 'මෙම කාර්යය මුදාහරින්නද?';

  @override
  String get bookingReleaseBody =>
      'එය නැවත වෙනත් සේවා සපයන්නෙකුට ගත හැකි විවෘත ඉල්ලීමක් බවට පත් වනු ඇත.';

  @override
  String get bookingReleaseReasonLabel => 'හේතුව';

  @override
  String get bookingReleased => 'කාර්යය මුදාහරින ලදී.';

  @override
  String get bookingAcceptJob => 'මෙම කාර්යය පිළිගන්න';

  @override
  String get bookingAcceptedMessage => 'කාර්යය පිළිගන්නා ලදී.';

  @override
  String get bookingDeclineOffer => 'ප්‍රතික්ෂේප කරන්න';

  @override
  String get bookingOfferDeclined => 'දීමනාව ප්‍රතික්ෂේප කරන ලදී.';

  @override
  String bookingOfferRespondBy(String time) {
    return '$time වන විට පිළිතුරු දෙන්න';
  }

  @override
  String get bookingStartEnRoute => 'මම මාර්ගයේ සිටිමි';

  @override
  String get bookingEnRouteStarted => 'මාර්ගයේ ලෙස සලකුණු කරන ලදී.';

  @override
  String get bookingMarkArrived => 'මම පැමිණ ඇත්තෙමි';

  @override
  String get bookingArrivedMarked => 'පැමිණි ලෙස සලකුණු කරන ලදී.';

  @override
  String get bookingStartWork => 'වැඩය ආරම්භ කරන්න';

  @override
  String get bookingWorkStarted => 'වැඩය ආරම්භ විය.';

  @override
  String get bookingComplete => 'සම්පූර්ණ ලෙස සලකුණු කරන්න';

  @override
  String get bookingCompletedMessage =>
      'වෙන්කිරීම සම්පූර්ණ ලෙස සලකුණු කරන ලදී.';

  @override
  String get bookingQuotesTitle => 'මිල ගණන්';

  @override
  String get bookingNoQuotesYet => 'තවම මිල ගණන් නොමැත.';

  @override
  String get bookingSubmitQuote => 'මිලක් ඉදිරිපත් කරන්න';

  @override
  String get bookingQuoteAmountLabel => 'ඔබේ මිල';

  @override
  String get bookingQuoteAmountInvalid =>
      'බිංදුවට වඩා වැඩි මුදලක් ඇතුළත් කරන්න.';

  @override
  String get bookingQuoteNoteLabel => 'සටහන (විකල්ප)';

  @override
  String get bookingQuoteSubmit => 'මිල ගණන් යවන්න';

  @override
  String get bookingQuoteSubmitted => 'මිල ගණන් යවන ලදී.';

  @override
  String get bookingAcceptQuote => 'පිළිගන්න';

  @override
  String get bookingRejectQuote => 'ප්‍රතික්ෂේප කරන්න';

  @override
  String get bookingQuoteAccepted => 'මිල ගණන් පිළිගන්නා ලදී.';

  @override
  String get bookingQuoteRejected => 'මිල ගණන් ප්‍රතික්ෂේප කරන ලදී.';

  @override
  String get quoteStatusPending => 'බලාපොරොත්තුවෙන්';

  @override
  String get quoteStatusAccepted => 'පිළිගන්නා ලදී';

  @override
  String get quoteStatusRejected => 'ප්‍රතික්ෂේප කරන ලදී';

  @override
  String get providerJobsTitle => 'රැකියා';

  @override
  String get providerJobsOpen => 'දීමනා';

  @override
  String get providerJobsAssigned => 'මගේ රැකියා';

  @override
  String get providerJobsOpenEmpty =>
      'දැනට දීමනා නොමැත. ඒවා ලැබීමට සබැඳි වන්න.';

  @override
  String get providerJobsAssignedEmpty => 'ඔබට තවම පවරන ලද රැකියා නොමැත.';

  @override
  String get serviceRequestTitle => 'මෙම සේවාව ඉල්ලන්න';

  @override
  String get serviceRequestOnDemand => 'දැන්ම';

  @override
  String get serviceRequestScheduled => 'වේලාවක් තෝරන්න';

  @override
  String get serviceRequestPickTime => 'දිනයක් සහ වේලාවක් තෝරන්න';

  @override
  String get serviceRequestScheduledTimeInvalid => 'අනාගත වේලාවක් තෝරන්න.';

  @override
  String get serviceRequestAddressLabel => 'සේවා ලිපිනය';

  @override
  String get serviceRequestAddressHint => 'සේවා සපයන්නා පැමිණිය යුත්තේ කොහේද?';

  @override
  String get serviceRequestAddressRequired => 'සේවා ලිපිනය ඇතුළත් කරන්න.';

  @override
  String get serviceRequestAddressTooLong => 'අක්ෂර 500ක් හෝ ඊට අඩු කරන්න.';

  @override
  String get serviceRequestNotesLabel => 'සේවා සපයන්නාට සටහන් (විකල්ප)';

  @override
  String get serviceRequestNotesHint =>
      'සේවා සපයන්නා කල් තියා දැනගත යුතු ඕනෑම දෙයක්.';

  @override
  String get serviceRequestNotesTooLong => 'අක්ෂර 1000ක් හෝ ඊට අඩු කරන්න.';

  @override
  String get serviceRequestSubmit => 'සේවාව ඉල්ලන්න';

  @override
  String get serviceRequestSent => 'ඉල්ලීම යවන ලදී.';

  @override
  String get serviceRequestUseMyLocation => 'මගේ වත්මන් ස්ථානය භාවිතා කරන්න';

  @override
  String get serviceRequestLocationSet => 'නිශ්චිත ස්ථානය එකතු කරන ලදී.';

  @override
  String get serviceRequestClearLocation => 'නිශ්චිත ස්ථානය ඉවත් කරන්න';

  @override
  String get locationPermissionDenied => 'ස්ථාන ප්‍රවේශයට අවසර දී නොමැත.';

  @override
  String get locationRetry => 'නැවත උත්සාහ කරන්න';

  @override
  String get locationPermissionDeniedForever =>
      'මෙම යෙදුම සඳහා ස්ථාන ප්‍රවේශය ක්‍රියාවිරහිත කර ඇත. එය භාවිතා කිරීමට සැකසුම් තුළින් සක්‍රිය කරන්න.';

  @override
  String get locationOpenSettings => 'සැකසුම් විවෘත කරන්න';

  @override
  String get locationServiceDisabled =>
      'මෙම උපාංගයේ ස්ථානය (GPS) ක්‍රියාවිරහිතයි.';

  @override
  String get locationEnableGps => 'ස්ථානය සක්‍රිය කරන්න';

  @override
  String get trackingCustomerLocationTitle => 'පාරිභෝගික ස්ථානය';

  @override
  String get trackingProviderLocationTitle => 'සේවා සපයන්නාගේ ස්ථානය';

  @override
  String get trackingSharingLocation =>
      'ඔබේ ස්ථානය පාරිභෝගිකයා සමඟ බෙදාගනිමින්.';

  @override
  String get trackingNotSharing => 'දැනට ඔබේ ස්ථානය බෙදා නොගනී.';

  @override
  String get trackingWaitingForLocation =>
      'ස්ථාන යාවත්කාලීනයක් සඳහා රැඳී සිටී.';

  @override
  String get trackingNavigate => 'මාර්ග උපදෙස්';

  @override
  String trackingDistanceAndEta(String distanceKm, String minutes) {
    return 'කි.මී. $distanceKm ක් දුරින් · මිනිත්තු $minutes ක් පමණ';
  }

  @override
  String get trackingLive => 'සජීවී';

  @override
  String get trackingConnecting => 'සම්බන්ධ වෙමින්…';

  @override
  String get trackingDisconnected => 'නැවත සම්බන්ධ වෙමින්…';

  @override
  String get errorQuoteNotApplicable =>
      'මෙම වර්ගයේ සේවාව සඳහා එය ලබා ගත නොහැක.';

  @override
  String get errorProviderNotEligible =>
      'මෙම නගරයේ මෙම සේවාව සඳහා ඔබ අනුමත කර නැත.';

  @override
  String get errorAlreadyQuoted =>
      'ඔබ දැනටමත් මෙම වෙන්කිරීම සඳහා මිලක් යවා ඇත.';

  @override
  String get errorPaymentNotReady =>
      'මෙම වෙන්කිරීම තවම සම්පූර්ණ කර නැත, එබැවින් ගෙවීමට කිසිවක් නැත.';

  @override
  String get errorPaymentAlreadyFinal => 'මෙම වෙන්කිරීම දැනටමත් ගෙවා ඇත.';

  @override
  String get paymentSectionTitle => 'ගෙවීම';

  @override
  String get paymentStatusPending => 'ගෙවීම අපේක්ෂිතයි';

  @override
  String get paymentStatusSucceeded => 'ගෙවා ඇත';

  @override
  String get paymentStatusFailed => 'ගෙවීම අසාර්ථකයි';

  @override
  String get paymentStatusCancelled => 'ගෙවීම අවලංගු කරන ලදී';

  @override
  String get paymentStatusRefunded => 'ආපසු ගෙවා ඇත';

  @override
  String get paymentServiceAmountLabel => 'සේවා මුදල';

  @override
  String get paymentCommissionLabel => 'වේදිකා ගාස්තුව';

  @override
  String get paymentProviderEarningLabel => 'ඔබ උපයන මුදල';

  @override
  String get paymentPayNow => 'දැන් ගෙවන්න';

  @override
  String get paymentRetry => 'නැවත ගෙවීමට උත්සාහ කරන්න';

  @override
  String get paymentCheckoutOpened =>
      'ගෙවීම් පිටුව ඔබේ බ්‍රවුසරයේ විවෘත විය. ගෙවීමෙන් පසු මෙහි ආපසු එන්න.';

  @override
  String get paymentCheckoutOpenFailed => 'ගෙවීම් පිටුව විවෘත කළ නොහැකි විය.';
}
