import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/network_providers.dart';
import 'package:mobile/core/utils/provider_retry.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/provider/data/provider_api_repository.dart';
import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';
import 'package:mobile/features/provider/domain/provider_repository.dart';
import 'package:mobile/features/services/application/catalogue_providers.dart';

final providerRepositoryProvider = Provider<ProviderRepository>(
  (ref) => ProviderApiRepository(ref.watch(apiClientProvider)),
);

/// Ties provider state to being signed in. Watching the status makes every
/// provider controller start over on sign-out and sign-in, so one person's
/// profile can never be shown to the next person on the same device (an account
/// switch always passes through signed-out). It deliberately does not watch the
/// user record: that loads just after launch and would cause a pointless
/// second fetch.
void _watchAccount(Ref ref) => ref.watch(authStatusProvider);

/// The signed-in user's own provider profile: null when they have none yet.
class ProviderProfileController extends AsyncNotifier<ProviderProfile?> {
  @override
  Future<ProviderProfile?> build() {
    _watchAccount(ref);
    return ref.watch(providerRepositoryProvider).fetchProfile();
  }

  /// Creates or updates the profile. On failure the exception propagates to the
  /// caller (the form shows it) and the loaded profile is left untouched.
  Future<ProviderProfile> save(ProviderProfileInput input) async {
    final saved = await ref.read(providerRepositoryProvider).saveProfile(input);
    state = AsyncData(saved);
    return saved;
  }

  /// Hands the profile in for review.
  Future<ProviderProfile> submit() async {
    final submitted = await ref
        .read(providerRepositoryProvider)
        .submitProfile();
    state = AsyncData(submitted);
    return submitted;
  }

  /// Toggles online/offline. Requires an existing profile: the caller checks
  /// [ProviderProfile] is non-null before offering this.
  Future<ProviderProfile> setAvailability(
    ProviderAvailability availability,
  ) async {
    final updated = await ref
        .read(providerRepositoryProvider)
        .setAvailability(availability);
    state = AsyncData(updated);
    return updated;
  }

  /// Reports the provider's current location as a matching input.
  Future<ProviderProfile> setLocation({
    required double latitude,
    required double longitude,
  }) async {
    final updated = await ref
        .read(providerRepositoryProvider)
        .setLocation(latitude: latitude, longitude: longitude);
    state = AsyncData(updated);
    return updated;
  }
}

final providerProfileProvider =
    AsyncNotifierProvider.autoDispose<
      ProviderProfileController,
      ProviderProfile?
    >(ProviderProfileController.new, retry: noAutomaticRetry);

/// What happened when applying for several services at once.
class ApplyOutcome {
  const ApplyOutcome({this.applied = const [], this.failed = const {}});

  /// Slugs that were sent successfully.
  final List<String> applied;

  /// Slugs that were not, with why.
  final Map<String, AppException> failed;

  bool get hasFailures => failed.isNotEmpty;
}

/// The signed-in provider's service/category applications.
class ApplicationsController extends AsyncNotifier<List<ProviderApplication>> {
  @override
  Future<List<ProviderApplication>> build() {
    _watchAccount(ref);
    // The language is part of what is fetched (category names), so a language
    // change reloads the list.
    final language = ref.watch(apiLanguageProvider);
    return ref
        .watch(providerRepositoryProvider)
        .listApplications(language: language);
  }

  String get _language => ref.read(apiLanguageProvider);

  /// Applies for each category in [categorySlugs] in [citySlug], one after the
  /// other. One failing (say, already applied) does not stop the rest, so the
  /// result reports each separately.
  Future<ApplyOutcome> applyMany({
    required String citySlug,
    required Iterable<String> categorySlugs,
  }) async {
    final repository = ref.read(providerRepositoryProvider);
    final applied = <String>[];
    final failed = <String, AppException>{};

    for (final slug in categorySlugs) {
      try {
        final application = await repository.apply(
          categorySlug: slug,
          citySlug: citySlug,
          language: _language,
        );
        applied.add(slug);
        _upsert(application);
      } on AppException catch (e) {
        failed[slug] = e;
      }
    }
    return ApplyOutcome(applied: applied, failed: failed);
  }

  /// Sends a rejected application again.
  Future<void> resubmit(String applicationId) async {
    final updated = await ref
        .read(providerRepositoryProvider)
        .resubmit(applicationId, language: _language);
    _upsert(updated);
  }

  /// Withdraws a pending or rejected application.
  Future<void> withdraw(String applicationId) async {
    await ref.read(providerRepositoryProvider).withdraw(applicationId);
    final current = state.value;
    if (current != null) {
      state = AsyncData([
        for (final a in current)
          if (a.id != applicationId) a,
      ]);
    }
  }

  void _upsert(ProviderApplication application) {
    final current = state.value;
    if (current == null) {
      // Not loaded yet: patching an empty list would hide every other
      // application, so fetch the real one.
      ref.invalidateSelf();
      return;
    }
    final index = current.indexWhere((a) => a.id == application.id);
    state = AsyncData(
      index == -1
          ? [...current, application]
          : [
              for (final a in current)
                if (a.id == application.id) application else a,
            ],
    );
  }
}

final applicationsProvider =
    AsyncNotifierProvider.autoDispose<
      ApplicationsController,
      List<ProviderApplication>
    >(ApplicationsController.new, retry: noAutomaticRetry);
