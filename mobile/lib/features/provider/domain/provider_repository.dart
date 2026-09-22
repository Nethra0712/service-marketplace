import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';

/// The signed-in user's own provider profile and service applications.
///
/// There is deliberately no way to approve, reject or suspend anything here:
/// those decisions belong to the platform.
abstract interface class ProviderRepository {
  /// The user's provider profile, or null if they have not created one yet.
  Future<ProviderProfile?> fetchProfile();

  /// Creates the profile, or updates it if it exists.
  Future<ProviderProfile> saveProfile(ProviderProfileInput input);

  /// Hands the profile in for review.
  Future<ProviderProfile> submitProfile();

  Future<List<ProviderApplication>> listApplications({
    required String language,
  });

  Future<ProviderApplication> apply({
    required String categorySlug,
    required String citySlug,
    required String language,
  });

  /// Sends a rejected application again.
  Future<ProviderApplication> resubmit(
    String applicationId, {
    required String language,
  });

  /// Withdraws a pending or rejected application.
  Future<void> withdraw(String applicationId);
}
