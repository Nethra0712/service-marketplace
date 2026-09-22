import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

/// A city the marketplace operates in.
class City {
  const City({
    required this.slug,
    required this.name,
    required this.countryCode,
    required this.timezone,
    required this.currency,
  });

  factory City.fromJson(Map<String, dynamic> json) => City(
    slug: readString(json, 'slug'),
    name: readString(json, 'name'),
    countryCode: readString(json, 'countryCode'),
    timezone: readString(json, 'timezone'),
    currency: readString(json, 'currency'),
  );

  final String slug;
  final String name;
  final String countryCode;
  final String timezone;

  /// ISO 4217, e.g. `LKR`.
  final String currency;
}

/// One service customers can ask for, in the language the request was made in.
class ServiceCategory {
  const ServiceCategory({
    required this.id,
    required this.slug,
    required this.name,
    required this.pricingModel,
    this.description,
  });

  factory ServiceCategory.fromJson(Map<String, dynamic> json) =>
      ServiceCategory(
        id: readString(json, 'id'),
        slug: readString(json, 'slug'),
        name: readString(json, 'name'),
        description: readStringOrNull(json, 'description'),
        pricingModel: readEnum(PricingModel.values, json, 'pricingModel'),
      );

  final String id;
  final String slug;
  final String name;
  final String? description;
  final PricingModel pricingModel;
}

/// A category with where it is offered and how many providers can be booked.
class ServiceCategoryDetail {
  const ServiceCategoryDetail({
    required this.category,
    required this.cities,
    required this.availableProviderCount,
  });

  factory ServiceCategoryDetail.fromJson(Map<String, dynamic> json) =>
      ServiceCategoryDetail(
        category: ServiceCategory.fromJson(json),
        cities: readObjects(
          json,
          'cities',
        ).map(City.fromJson).toList(growable: false),
        availableProviderCount: readInt(json, 'availableProviderCount'),
      );

  final ServiceCategory category;
  final List<City> cities;

  /// Approved, verified providers a customer could be matched with today.
  final int availableProviderCount;
}
