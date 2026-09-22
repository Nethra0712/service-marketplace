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
}
