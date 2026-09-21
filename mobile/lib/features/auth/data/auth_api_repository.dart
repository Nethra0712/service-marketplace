import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/core/utils/clock.dart';
import 'package:mobile/features/auth/domain/auth_repository.dart';
import 'package:mobile/features/auth/domain/auth_session.dart';
import 'package:mobile/features/auth/domain/otp_challenge.dart';

/// [AuthRepository] backed by the platform API. Takes the *unauthenticated*
/// client: these calls create or end a session, so they carry no access token.
class AuthApiRepository implements AuthRepository {
  AuthApiRepository(this._api, this._now);

  final ApiClient _api;
  final Clock _now;

  @override
  Future<OtpChallenge> requestOtp(String phoneE164) async {
    final data = await _api.post(
      '/api/auth/otp/request',
      data: {'phone': phoneE164},
    );
    return OtpChallenge.fromJson(asJsonObject(data));
  }

  @override
  Future<AuthSession> verifyOtp({
    required String challengeId,
    required String code,
  }) async {
    final data = await _api.post(
      '/api/auth/otp/verify',
      data: {'challengeId': challengeId, 'code': code},
    );
    return AuthSession.fromTokenResponse(asJsonObject(data), _now());
  }

  @override
  Future<AuthSession> refresh(String refreshToken) async {
    final data = await _api.post(
      '/api/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    return AuthSession.fromTokenResponse(asJsonObject(data), _now());
  }

  @override
  Future<void> logout(String refreshToken) async {
    await _api.post('/api/auth/logout', data: {'refreshToken': refreshToken});
  }
}
