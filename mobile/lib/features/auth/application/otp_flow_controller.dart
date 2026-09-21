import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/utils/clock.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/application/otp_flow_state.dart';
import 'package:mobile/features/auth/domain/phone_number.dart';

/// Backend error codes this flow reacts to (see the server's `ErrorCode`).
abstract final class _Codes {
  static const invalidOtp = 'INVALID_OTP';
  static const attemptsExceeded = 'OTP_ATTEMPTS_EXCEEDED';
  static const resendCooldown = 'OTP_RESEND_COOLDOWN';
  static const rateLimited = 'RATE_LIMITED';
  static const smsUnavailable = 'SMS_UNAVAILABLE';
  static const accountSuspended = 'ACCOUNT_SUSPENDED';
  static const validation = 'VALIDATION_ERROR';
}

/// Translates a failed request into what the person should be told.
OtpFlowError mapOtpError(AppException error) {
  switch (error) {
    case NetworkException() || NetworkTimeoutException():
      return OtpFlowError.network;
    case ForbiddenException(code: _Codes.accountSuspended):
      return OtpFlowError.accountSuspended;
    case UnauthorizedException(code: _Codes.invalidOtp):
      return OtpFlowError.invalidCode;
    case ApiException(code: _Codes.attemptsExceeded):
      return OtpFlowError.attemptsExceeded;
    case ApiException(code: _Codes.resendCooldown):
      return OtpFlowError.cooldown;
    case ApiException(code: _Codes.rateLimited):
      return OtpFlowError.rateLimited;
    case ApiException(code: _Codes.validation):
      return OtpFlowError.invalidPhone;
    case ServerException(code: _Codes.smsUnavailable):
      return OtpFlowError.smsUnavailable;
    default:
      return OtpFlowError.unknown;
  }
}

/// Drives the sign-in screens: request a code, wait for it, verify it.
///
/// Auto-disposed, so leaving the sign-in screens (or signing in) discards the
/// phone number and challenge instead of keeping them in memory.
class OtpFlowController extends Notifier<OtpFlowState> {
  static final _codeFormat = RegExp(r'^\d{4,8}$');

  @override
  OtpFlowState build() => const OtpFlowState();

  /// Validates the typed number and asks the server to text it a code.
  /// Returns true if a code was sent.
  Future<bool> submitPhone(String input) async {
    final phone = normalizeToE164(input);
    if (phone == null) {
      state = state.copyWith(error: OtpFlowError.invalidPhone);
      return false;
    }
    return _requestCode(phone);
  }

  /// Asks for a new code for the same number, once the cooldown has passed.
  Future<bool> resend() async {
    final phone = state.phoneE164;
    if (phone == null || state.isBusy) return false;

    if (!state.canResend(ref.read(clockProvider)())) {
      state = state.copyWith(error: OtpFlowError.cooldown);
      return false;
    }
    return _requestCode(phone);
  }

  /// Checks the typed code. On success the user is signed in, which the router
  /// reacts to by leaving the sign-in screens. Returns true on success.
  Future<bool> submitCode(String input) async {
    final challenge = state.challenge;
    if (challenge == null || state.isBusy) return false;

    final code = input.trim();
    if (!_codeFormat.hasMatch(code)) {
      state = state.copyWith(error: OtpFlowError.invalidCode);
      return false;
    }

    state = state.copyWith(status: OtpFlowStatus.verifying, clearError: true);
    try {
      final session = await ref
          .read(authRepositoryProvider)
          .verifyOtp(challengeId: challenge.challengeId, code: code);
      await ref.read(authControllerProvider.notifier).signIn(session);
      // Signing in swaps the screens out, which may already have disposed us.
      if (ref.mounted) state = const OtpFlowState();
      return true;
    } on AppException catch (error) {
      state = state.copyWith(
        status: OtpFlowStatus.awaitingCode,
        error: mapOtpError(error),
      );
      return false;
    }
  }

  /// Goes back to entering a phone number.
  void changeNumber() => state = const OtpFlowState();

  void clearError() => state = state.copyWith(clearError: true);

  Future<bool> _requestCode(String phone) async {
    final previous = state;
    state = state.copyWith(
      status: OtpFlowStatus.requestingCode,
      phoneE164: phone,
      clearError: true,
    );
    final now = ref.read(clockProvider);

    try {
      final challenge = await ref
          .read(authRepositoryProvider)
          .requestOtp(phone);
      state = OtpFlowState(
        status: OtpFlowStatus.awaitingCode,
        phoneE164: phone,
        challenge: challenge,
        resendAvailableAt: now().add(
          Duration(seconds: challenge.resendAfterSeconds),
        ),
      );
      return true;
    } on AppException catch (error) {
      // Stay where we were: on the phone screen for a first request, or on the
      // code screen when resending.
      final stillHasCode = previous.challenge != null;
      state = previous.copyWith(
        status: stillHasCode ? OtpFlowStatus.awaitingCode : OtpFlowStatus.idle,
        phoneE164: phone,
        // The server tells us how long to wait; honour it.
        resendAvailableAt:
            error is ApiException && error.retryAfterSeconds != null
            ? now().add(Duration(seconds: error.retryAfterSeconds!))
            : previous.resendAvailableAt,
        error: mapOtpError(error),
      );
      return false;
    }
  }
}

final otpFlowControllerProvider =
    NotifierProvider.autoDispose<OtpFlowController, OtpFlowState>(
      OtpFlowController.new,
    );
