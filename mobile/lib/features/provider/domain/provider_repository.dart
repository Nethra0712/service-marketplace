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

  /// The provider's own online/offline toggle, i.e. whether they can
  /// currently be dispatched a new job.
  Future<ProviderProfile> setAvailability(ProviderAvailability availability);

  /// Reports the provider's current location, used only as a matching input
  /// (distance ranking). Overwrites the previous value; no history is kept.
  Future<ProviderProfile> setLocation({
    required double latitude,
    required double longitude,
  });

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
