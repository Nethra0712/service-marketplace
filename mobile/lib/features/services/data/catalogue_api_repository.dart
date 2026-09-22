import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/services/domain/catalogue_repository.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';
import 'package:mobile/features/services/domain/service_category.dart';

/// [CatalogueRepository] backed by the platform API.
class CatalogueApiRepository implements CatalogueRepository {
  CatalogueApiRepository(this._api);

  final ApiClient _api;

  @override
  Future<List<City>> listCities() async {
    final data = asJsonObject(await _api.get('/api/cities'));
    return parseResponse(
      () =>
          readObjects(data, 'items').map(City.fromJson).toList(growable: false),
    );
  }

  @override
  Future<List<ServiceCategory>> listCategories({
    required String language,
    String? search,
    PricingModel? pricingModel,
    String? citySlug,
  }) async {
    final trimmed = search?.trim();
    final data = asJsonObject(
      await _api.get(
        '/api/service-categories',
        queryParameters: {
          'lang': language,
          if (trimmed != null && trimmed.isNotEmpty) 'q': trimmed,
          'pricingModel': ?pricingModel?.name,
          'city': ?citySlug,
        },
      ),
    );
    return parseResponse(
      () => readObjects(
        data,
        'items',
      ).map(ServiceCategory.fromJson).toList(growable: false),
    );
  }

  @override
  Future<ServiceCategoryDetail> getCategory(
    String slug, {
    required String language,
    String? citySlug,
  }) async {
    final data = asJsonObject(
      await _api.get(
        '/api/service-categories/${Uri.encodeComponent(slug)}',
        queryParameters: {'lang': language, 'city': ?citySlug},
      ),
    );
    return parseResponse(() => ServiceCategoryDetail.fromJson(data));
  }
}
