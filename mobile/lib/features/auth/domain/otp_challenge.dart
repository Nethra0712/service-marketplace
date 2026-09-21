import 'package:mobile/core/errors/app_exception.dart';

/// A verification code the server has sent by SMS and is waiting to be checked.
class OtpChallenge {
  const OtpChallenge({
    required this.challengeId,
    required this.expiresInSeconds,
    required this.resendAfterSeconds,
  });

  factory OtpChallenge.fromJson(Map<String, dynamic> json) {
    final challengeId = json['challengeId'];
    final expiresIn = json['expiresInSeconds'];
    final resendAfter = json['resendAfterSeconds'];
    if (challengeId is! String || expiresIn is! int || resendAfter is! int) {
      throw const UnknownException('Unexpected code-request response.');
    }
    return OtpChallenge(
      challengeId: challengeId,
      expiresInSeconds: expiresIn,
      resendAfterSeconds: resendAfter,
    );
  }

  final String challengeId;
  final int expiresInSeconds;

  /// How long the user must wait before asking for another code.
  final int resendAfterSeconds;
}
