import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/features/auth/application/otp_flow_state.dart';

/// The localized sentence shown for each way the sign-in flow can fail.
String otpErrorMessage(AppLocalizations l10n, OtpFlowError error) =>
    switch (error) {
      OtpFlowError.invalidPhone => l10n.errorInvalidPhone,
      OtpFlowError.invalidCode => l10n.errorInvalidCode,
      OtpFlowError.attemptsExceeded => l10n.errorAttemptsExceeded,
      OtpFlowError.cooldown => l10n.errorCooldown,
      OtpFlowError.rateLimited => l10n.errorRateLimited,
      OtpFlowError.network => l10n.errorNetwork,
      OtpFlowError.smsUnavailable => l10n.errorSmsUnavailable,
      OtpFlowError.accountSuspended => l10n.errorAccountSuspended,
      OtpFlowError.unknown => l10n.errorGeneric,
    };
