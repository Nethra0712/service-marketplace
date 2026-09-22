import 'package:mobile/features/services/domain/pricing_model.dart';
import 'package:mobile/features/services/domain/service_category.dart';

/// Read-only access to the service catalogue. Every method takes the language
/// to answer in (`en`, `si` or `ta`).
abstract interface class CatalogueRepository {
  Future<List<City>> listCities();

  Future<List<ServiceCategory>> listCategories({
    required String language,
    String? search,
    PricingModel? pricingModel,
    String? citySlug,
  });

  Future<ServiceCategoryDetail> getCategory(
    String slug, {
    required String language,
    String? citySlug,
  });
}
