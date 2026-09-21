import 'package:mobile/features/auth/domain/otp_challenge.dart';

/// Where the person is in the phone-and-code sign-in.
enum OtpFlowStatus {
  /// Entering the phone number (nothing sent yet, or the last request failed).
  idle,

  /// Waiting for the server to send the code.
  requestingCode,

  /// A code was sent; waiting for the person to type it in.
  awaitingCode,

  /// Checking the typed code with the server.
  verifying,
}

/// Why the last step failed, in terms the UI can explain. The screens map each
/// value to a localized message; nothing here is user-visible text.
enum OtpFlowError {
  invalidPhone,
  invalidCode,
  attemptsExceeded,
  cooldown,
  rateLimited,
  network,
  smsUnavailable,
  accountSuspended,
  unknown,
}

class OtpFlowState {
  const OtpFlowState({
    this.status = OtpFlowStatus.idle,
    this.phoneE164,
    this.challenge,
    this.resendAvailableAt,
    this.error,
  });

  final OtpFlowStatus status;

  /// The number the code was requested for, in international format.
  final String? phoneE164;
  final OtpChallenge? challenge;

  /// The earliest moment another code may be requested.
  final DateTime? resendAvailableAt;
  final OtpFlowError? error;

  bool get isBusy =>
      status == OtpFlowStatus.requestingCode ||
      status == OtpFlowStatus.verifying;

  /// True when a code was sent and the resend cooldown has elapsed.
  bool canResend(DateTime now) =>
      status == OtpFlowStatus.awaitingCode &&
      (resendAvailableAt == null || !now.isBefore(resendAvailableAt!));

  /// Whole seconds left before resending is allowed (0 when allowed).
  int secondsUntilResend(DateTime now) {
    final at = resendAvailableAt;
    if (at == null || !now.isBefore(at)) return 0;
    return (at.difference(now).inMilliseconds / 1000).ceil();
  }

  OtpFlowState copyWith({
    OtpFlowStatus? status,
    String? phoneE164,
    OtpChallenge? challenge,
    DateTime? resendAvailableAt,
    OtpFlowError? error,
    bool clearError = false,
  }) => OtpFlowState(
    status: status ?? this.status,
    phoneE164: phoneE164 ?? this.phoneE164,
    challenge: challenge ?? this.challenge,
    resendAvailableAt: resendAvailableAt ?? this.resendAvailableAt,
    error: clearError ? null : (error ?? this.error),
  );
}
