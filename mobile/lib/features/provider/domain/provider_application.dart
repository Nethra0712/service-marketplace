import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

/// A provider's standing for one service category in one city.
enum ApplicationStatus { pending, approved, rejected, suspended }

/// One service/category application and its approval state.
class ProviderApplication {
  const ProviderApplication({
    required this.id,
    required this.status,
    required this.categoryId,
    required this.categorySlug,
    required this.categoryName,
    required this.pricingModel,
    required this.citySlug,
    required this.cityName,
    this.reviewNote,
    this.reviewedAt,
  });

  factory ProviderApplication.fromJson(Map<String, dynamic> json) {
    final category = asJsonObject(json['category']);
    final city = asJsonObject(json['city']);
    return ProviderApplication(
      id: readString(json, 'id'),
      status: readEnum(ApplicationStatus.values, json, 'status'),
      reviewNote: readStringOrNull(json, 'reviewNote'),
      reviewedAt: readDateTimeOrNull(json, 'reviewedAt'),
      categoryId: readString(category, 'id'),
      categorySlug: readString(category, 'slug'),
      categoryName: readString(category, 'name'),
      pricingModel: readEnum(PricingModel.values, category, 'pricingModel'),
      citySlug: readString(city, 'slug'),
      cityName: readString(city, 'name'),
    );
  }

  final String id;
  final ApplicationStatus status;
  final String? reviewNote;
  final DateTime? reviewedAt;
  final String categoryId;
  final String categorySlug;
  final String categoryName;
  final PricingModel pricingModel;
  final String citySlug;
  final String cityName;

  /// Only a rejected application can be sent again.
  bool get canResubmit => status == ApplicationStatus.rejected;

  /// Approved and suspended applications are decisions the platform owns; the
  /// provider can only withdraw one that has not been granted.
  bool get canWithdraw =>
      status == ApplicationStatus.pending ||
      status == ApplicationStatus.rejected;
}
