import 'package:mobile/core/network/json_helpers.dart';

/// Where a provider's profile is in review. Mirrors the backend's
/// `provider_verification_status`. Separate from the per-service status: a
/// provider must be verified *and* approved for a service to be bookable.
enum VerificationStatus { draft, submitted, verified, rejected }

/// What a provider entered about themselves. Only the fields the provider is
/// allowed to set; review status is decided by the platform.
class ProviderProfileInput {
  const ProviderProfileInput({
    required this.fullName,
    this.bio,
    this.yearsOfExperience,
  });

  final String fullName;
  final String? bio;
  final int? yearsOfExperience;
}

/// The signed-in user's own provider profile.
class ProviderProfile {
  const ProviderProfile({
    required this.id,
    required this.verificationStatus,
    this.fullName,
    this.bio,
    this.yearsOfExperience,
    this.submittedAt,
    this.reviewedAt,
    this.reviewNote,
  });

  factory ProviderProfile.fromJson(Map<String, dynamic> json) =>
      ProviderProfile(
        id: readString(json, 'id'),
        fullName: readStringOrNull(json, 'fullName'),
        bio: readStringOrNull(json, 'bio'),
        yearsOfExperience: readIntOrNull(json, 'yearsOfExperience'),
        verificationStatus: readEnum(
          VerificationStatus.values,
          json,
          'verificationStatus',
        ),
        submittedAt: readDateTimeOrNull(json, 'submittedAt'),
        reviewedAt: readDateTimeOrNull(json, 'reviewedAt'),
        reviewNote: readStringOrNull(json, 'reviewNote'),
      );

  final String id;
  final String? fullName;
  final String? bio;
  final int? yearsOfExperience;
  final VerificationStatus verificationStatus;
  final DateTime? submittedAt;
  final DateTime? reviewedAt;

  /// The reviewer's reason, for example why the profile was rejected.
  final String? reviewNote;

  /// The backend accepts a submission from these two states only.
  bool get canSubmit =>
      verificationStatus == VerificationStatus.draft ||
      verificationStatus == VerificationStatus.rejected;

  bool get isVerified => verificationStatus == VerificationStatus.verified;
}
