import 'dart:ui' show PlatformDispatcher;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/locale_provider.dart';
import 'package:mobile/core/network/network_providers.dart';
import 'package:mobile/core/utils/provider_retry.dart';
import 'package:mobile/features/services/data/catalogue_api_repository.dart';
import 'package:mobile/features/services/domain/catalogue_repository.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';
import 'package:mobile/features/services/domain/service_category.dart';

/// Languages the backend can answer in.
const _backendLanguages = {'en', 'si', 'ta'};

/// The language to ask the backend for: the user's choice, else the device's,
/// else English. Watching this re-fetches everything when the language changes.
final apiLanguageProvider = Provider<String>((ref) {
  final chosen = ref.watch(localeProvider)?.languageCode;
  final code = chosen ?? PlatformDispatcher.instance.locale.languageCode;
  return _backendLanguages.contains(code) ? code : 'en';
});

final catalogueRepositoryProvider = Provider<CatalogueRepository>(
  (ref) => CatalogueApiRepository(ref.watch(apiClientProvider)),
);

/// What the customer has typed and picked on the services list.
class CatalogueFilter {
  const CatalogueFilter({this.search = '', this.pricingModel});

  final String search;
  final PricingModel? pricingModel;

  bool get isActive => search.trim().isNotEmpty || pricingModel != null;

  CatalogueFilter withSearch(String value) =>
      CatalogueFilter(search: value, pricingModel: pricingModel);

  /// Passing null clears the pricing filter.
  CatalogueFilter withPricingModel(PricingModel? value) =>
      CatalogueFilter(search: search, pricingModel: value);
}

class CatalogueFilterNotifier extends Notifier<CatalogueFilter> {
  @override
  CatalogueFilter build() => const CatalogueFilter();

  void setSearch(String value) => state = state.withSearch(value);

  void setPricingModel(PricingModel? value) =>
      state = state.withPricingModel(value);

  void clear() => state = const CatalogueFilter();
}

final catalogueFilterProvider =
    NotifierProvider.autoDispose<CatalogueFilterNotifier, CatalogueFilter>(
      CatalogueFilterNotifier.new,
    );

/// The categories matching the current filter, in the current language.
final categoryListProvider = FutureProvider.autoDispose<List<ServiceCategory>>((
  ref,
) {
  final filter = ref.watch(catalogueFilterProvider);
  final language = ref.watch(apiLanguageProvider);
  return ref
      .watch(catalogueRepositoryProvider)
      .listCategories(
        language: language,
        search: filter.search,
        pricingModel: filter.pricingModel,
      );
}, retry: noAutomaticRetry);

/// One category with where it is offered. Keyed by slug.
final categoryDetailProvider = FutureProvider.autoDispose
    .family<ServiceCategoryDetail, String>((ref, slug) {
      final language = ref.watch(apiLanguageProvider);
      return ref
          .watch(catalogueRepositoryProvider)
          .getCategory(slug, language: language);
    }, retry: noAutomaticRetry);

/// The cities the marketplace operates in.
final citiesProvider = FutureProvider.autoDispose<List<City>>(
  (ref) => ref.watch(catalogueRepositoryProvider).listCities(),
  retry: noAutomaticRetry,
);

/// Every category offered in the city with this slug (for choosing services to
/// apply for). Unfiltered by search: the person is ticking boxes, not browsing.
final categoriesInCityProvider = FutureProvider.autoDispose
    .family<List<ServiceCategory>, String>((ref, citySlug) {
      final language = ref.watch(apiLanguageProvider);
      return ref
          .watch(catalogueRepositoryProvider)
          .listCategories(language: language, citySlug: citySlug);
    }, retry: noAutomaticRetry);
