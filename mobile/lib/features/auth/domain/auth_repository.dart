import 'package:mobile/features/auth/domain/auth_session.dart';
import 'package:mobile/features/auth/domain/current_user.dart';
import 'package:mobile/features/auth/domain/otp_challenge.dart';

/// The calls that establish, renew and end a session. None of them needs an
/// access token.
///
/// Implementations throw `AppException` subtypes only.
abstract interface class AuthRepository {
  /// Asks the server to text a code to [phoneE164].
  Future<OtpChallenge> requestOtp(String phoneE164);

  /// Exchanges a correct code for a session. Creates the account on first use.
  Future<AuthSession> verifyOtp({
    required String challengeId,
    required String code,
  });

  /// Trades a refresh token for a new session. Each refresh token works once.
  Future<AuthSession> refresh(String refreshToken);

  /// Ends the session the refresh token belongs to.
  Future<void> logout(String refreshToken);
}

/// Reads the signed-in user. Needs a valid access token.
abstract interface class CurrentUserRepository {
  Future<CurrentUser> fetchCurrentUser();
}
