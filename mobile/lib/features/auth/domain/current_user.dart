import 'package:mobile/core/errors/app_exception.dart';

/// The signed-in user, as returned by `GET /api/auth/me`.
class CurrentUser {
  const CurrentUser({
    required this.id,
    required this.phone,
    required this.roles,
    this.fullName,
  });

  factory CurrentUser.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final phone = json['phone'];
    final roles = json['roles'];
    final profile = json['profile'];

    if (id is! String || phone is! String || roles is! List) {
      throw const UnknownException('Unexpected user response.');
    }
    return CurrentUser(
      id: id,
      phone: phone,
      roles: roles.whereType<String>().toList(growable: false),
      fullName: profile is Map<String, dynamic>
          ? profile['fullName'] as String?
          : null,
    );
  }

  final String id;

  /// International format, e.g. `+94771234567`.
  final String phone;

  /// `customer`, and `provider` once the user has a provider profile.
  final List<String> roles;
  final String? fullName;
}
