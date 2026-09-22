import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';
import 'package:mobile/features/provider/domain/provider_repository.dart';

/// The backend's code for "this user has no provider profile yet".
const providerProfileNotFoundCode = 'PROVIDER_PROFILE_NOT_FOUND';

/// [ProviderRepository] backed by the platform API. Takes the authenticated
/// client: every one of these routes requires a signed-in user.
class ProviderApiRepository implements ProviderRepository {
  ProviderApiRepository(this._api);

  final ApiClient _api;

  @override
  Future<ProviderProfile?> fetchProfile() async {
    final Object? data;
    try {
      data = await _api.get('/api/provider/profile');
    } on NotFoundException catch (e) {
      // "No profile yet" is a normal state for someone who has not applied.
      // Any other 404 is a real problem and is not swallowed.
      if (e.code == providerProfileNotFoundCode) return null;
      rethrow;
    }
    return parseResponse(() => ProviderProfile.fromJson(asJsonObject(data)));
  }

  @override
  Future<ProviderProfile> saveProfile(ProviderProfileInput input) async {
    final bio = input.bio?.trim();
    final data = await _api.put(
      '/api/provider/profile',
      data: {
        'fullName': input.fullName.trim(),
        // An explicit null clears the field on the server.
        'bio': bio == null || bio.isEmpty ? null : bio,
        'yearsOfExperience': input.yearsOfExperience,
      },
    );
    return parseResponse(() => ProviderProfile.fromJson(asJsonObject(data)));
  }

  @override
  Future<ProviderProfile> submitProfile() async {
    final data = await _api.post('/api/provider/profile/submit');
    return parseResponse(() => ProviderProfile.fromJson(asJsonObject(data)));
  }

  @override
  Future<List<ProviderApplication>> listApplications({
    required String language,
  }) async {
    final data = asJsonObject(
      await _api.get(
        '/api/provider/services',
        queryParameters: {'lang': language},
      ),
    );
    return parseResponse(
      () => readObjects(
        data,
        'items',
      ).map(ProviderApplication.fromJson).toList(growable: false),
    );
  }

  @override
  Future<ProviderApplication> apply({
    required String categorySlug,
    required String citySlug,
    required String language,
  }) async {
    final data = await _api.post(
      '/api/provider/services',
      queryParameters: {'lang': language},
      data: {'categorySlug': categorySlug, 'citySlug': citySlug},
    );
    return parseResponse(
      () => ProviderApplication.fromJson(asJsonObject(data)),
    );
  }

  @override
  Future<ProviderApplication> resubmit(
    String applicationId, {
    required String language,
  }) async {
    final data = await _api.post(
      '/api/provider/services/${Uri.encodeComponent(applicationId)}/resubmit',
      queryParameters: {'lang': language},
    );
    return parseResponse(
      () => ProviderApplication.fromJson(asJsonObject(data)),
    );
  }

  @override
  Future<void> withdraw(String applicationId) async {
    await _api.delete(
      '/api/provider/services/${Uri.encodeComponent(applicationId)}',
    );
  }
}
