import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/errors/app_exception.dart';

/// The localized sentence for any error a repository can throw.
///
/// Decided by the backend's stable error `code` first (it says exactly what
/// went wrong), then by the kind of exception. Nothing the server wrote is ever
/// shown: only text we translated.
String errorMessage(AppLocalizations l10n, Object error) {
  if (error is! AppException) return l10n.errorGeneric;

  switch (error.code) {
    case 'ALREADY_APPLIED':
      return l10n.errorAlreadyApplied;
    case 'PROFILE_INCOMPLETE':
      return l10n.errorProfileIncomplete;
    case 'INVALID_STATE':
      return l10n.errorInvalidState;
    case 'PROVIDER_PROFILE_REQUIRED':
      return l10n.errorProfileRequired;
    case 'VALIDATION_ERROR':
      return l10n.errorValidation;
    case 'RATE_LIMITED':
      return l10n.errorRateLimited;
    case 'QUOTE_NOT_APPLICABLE':
      return l10n.errorQuoteNotApplicable;
    case 'PROVIDER_NOT_ELIGIBLE':
      return l10n.errorProviderNotEligible;
    case 'ALREADY_QUOTED':
      return l10n.errorAlreadyQuoted;
    case 'PAYMENT_NOT_READY':
      return l10n.errorPaymentNotReady;
    case 'PAYMENT_ALREADY_FINAL':
      return l10n.errorPaymentAlreadyFinal;
  }

  return switch (error) {
    NetworkException() || NetworkTimeoutException() => l10n.errorNetwork,
    NotFoundException() => l10n.errorNotFound,
    ApiException(statusCode: 429) => l10n.errorRateLimited,
    _ => l10n.errorGeneric,
  };
}
