import 'package:mobile/core/errors/app_exception.dart';

/// The credentials that make up a signed-in session.
///
/// Expiry times are stored as absolute instants computed on the device when
/// the tokens arrive (`now + expiresIn`), so a wrong device clock cannot make
/// the server's relative lifetimes come out wrong.
class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.accessTokenExpiresAt,
    required this.refreshToken,
    required this.refreshTokenExpiresAt,
  });

  /// Builds a session from the backend's token response
  /// (`accessTokenExpiresInSeconds`, `refreshTokenExpiresInSeconds`).
  factory AuthSession.fromTokenResponse(
    Map<String, dynamic> json,
    DateTime now,
  ) {
    final accessToken = json['accessToken'];
    final accessSeconds = json['accessTokenExpiresInSeconds'];
    final refreshToken = json['refreshToken'];
    final refreshSeconds = json['refreshTokenExpiresInSeconds'];

    if (accessToken is! String ||
        refreshToken is! String ||
        accessSeconds is! int ||
        refreshSeconds is! int) {
      throw const UnknownException('Unexpected sign-in response.');
    }
    return AuthSession(
      accessToken: accessToken,
      accessTokenExpiresAt: now.add(Duration(seconds: accessSeconds)),
      refreshToken: refreshToken,
      refreshTokenExpiresAt: now.add(Duration(seconds: refreshSeconds)),
    );
  }

  /// Restores a session saved with [toJson]. Throws if the data is malformed.
  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    accessToken: json['accessToken'] as String,
    accessTokenExpiresAt: DateTime.parse(
      json['accessTokenExpiresAt'] as String,
    ),
    refreshToken: json['refreshToken'] as String,
    refreshTokenExpiresAt: DateTime.parse(
      json['refreshTokenExpiresAt'] as String,
    ),
  );

  final String accessToken;
  final DateTime accessTokenExpiresAt;
  final String refreshToken;
  final DateTime refreshTokenExpiresAt;

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'accessTokenExpiresAt': accessTokenExpiresAt.toUtc().toIso8601String(),
    'refreshToken': refreshToken,
    'refreshTokenExpiresAt': refreshTokenExpiresAt.toUtc().toIso8601String(),
  };

  /// True once the access token is expired, or will be within [skew]. Refreshing
  /// slightly early avoids sending a request that is already doomed to fail.
  bool isAccessTokenExpiring(
    DateTime now, {
    Duration skew = const Duration(seconds: 30),
  }) => !now.add(skew).isBefore(accessTokenExpiresAt);

  bool isRefreshTokenExpired(DateTime now) =>
      !now.isBefore(refreshTokenExpiresAt);

  /// Never prints the tokens, so a stray `print(session)` or log line cannot leak them.
  @override
  String toString() => 'AuthSession(<redacted>)';
}
