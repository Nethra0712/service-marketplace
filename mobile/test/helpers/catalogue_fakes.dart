import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';
import 'package:mobile/features/provider/domain/provider_repository.dart';
import 'package:mobile/features/services/domain/catalogue_repository.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';
import 'package:mobile/features/services/domain/service_category.dart';

const colombo = City(
  slug: 'colombo',
  name: 'Colombo',
  countryCode: 'LK',
  timezone: 'Asia/Colombo',
  currency: 'LKR',
);

const kandy = City(
  slug: 'kandy',
  name: 'Kandy',
  countryCode: 'LK',
  timezone: 'Asia/Colombo',
  currency: 'LKR',
);

ServiceCategory category(
  String slug,
  String name, {
  String? description,
  PricingModel pricingModel = PricingModel.quote,
}) => ServiceCategory(
  id: 'id-$slug',
  slug: slug,
  name: name,
  description: description,
  pricingModel: pricingModel,
);

/// Sinhala and Tamil wording, the way the backend would return it for `?lang=`.
const _translated = {
  'si': {'plumbing': 'ජලනල කටයුතු', 'cleaning': 'පිරිසිදු කිරීම'},
  'ta': {'plumbing': 'குழாய் வேலை', 'cleaning': 'சுத்தம் செய்தல்'},
};

/// An in-memory catalogue that behaves like the server: it filters by the same
/// inputs, and answers in the requested language.
class FakeCatalogueRepository implements CatalogueRepository {
  FakeCatalogueRepository({
    List<ServiceCategory>? categories,
    this.cities = const [colombo],
    this.availableProviders = const {},
  }) : categories =
           categories ??
           [
             category(
               'plumbing',
               'Plumbing',
               description: 'Leaks, drains and taps.',
               pricingModel: PricingModel.quote,
             ),
             category(
               'cleaning',
               'Cleaning',
               description: 'Home and office cleaning.',
               pricingModel: PricingModel.hourly,
             ),
             category(
               'ac-repair',
               'AC Repair',
               description: 'Service and repair of air conditioners.',
               pricingModel: PricingModel.fixed,
             ),
           ];

  final List<ServiceCategory> categories;
  final List<City> cities;

  /// Bookable providers per category slug.
  final Map<String, int> availableProviders;

  /// Slugs the server would treat as unknown or inactive (404).
  final Set<String> hidden = {};

  /// Make every call fail, as an unreachable server would.
  AppException? failWith;

  final listCalls =
      <({String language, String? search, PricingModel? model})>[];
  final detailCalls = <({String slug, String language})>[];

  ServiceCategory _localized(ServiceCategory c, String language) {
    final name = _translated[language]?[c.slug];
    return name == null
        ? c
        : ServiceCategory(
            id: c.id,
            slug: c.slug,
            name: name,
            description: c.description,
            pricingModel: c.pricingModel,
          );
  }

  @override
  Future<List<City>> listCities() async {
    if (failWith case final error?) throw error;
    return cities;
  }

  @override
  Future<List<ServiceCategory>> listCategories({
    required String language,
    String? search,
    PricingModel? pricingModel,
    String? citySlug,
  }) async {
    listCalls.add((language: language, search: search, model: pricingModel));
    if (failWith case final error?) throw error;

    final needle = search?.trim().toLowerCase() ?? '';
    return [
      for (final c in categories)
        if (!hidden.contains(c.slug))
          if (pricingModel == null || c.pricingModel == pricingModel)
            if (needle.isEmpty ||
                _localized(c, language).name.toLowerCase().contains(needle) ||
                (c.description ?? '').toLowerCase().contains(needle))
              _localized(c, language),
    ];
  }

  @override
  Future<ServiceCategoryDetail> getCategory(
    String slug, {
    required String language,
    String? citySlug,
  }) async {
    detailCalls.add((slug: slug, language: language));
    if (failWith case final error?) throw error;
    final match = categories.where(
      (c) => c.slug == slug && !hidden.contains(slug),
    );
    if (match.isEmpty) throw const NotFoundException('Not found.');
    return ServiceCategoryDetail(
      category: _localized(match.first, language),
      cities: cities,
      availableProviderCount: availableProviders[slug] ?? 0,
    );
  }
}

/// An in-memory provider backend that enforces the same rules as the server, so
/// screen tests exercise real flows (duplicates, missing profile, resubmit).
class FakeProviderRepository implements ProviderRepository {
  FakeProviderRepository({
    this.profile,
    List<ProviderApplication>? applications,
  }) : applications = [...?applications];

  ProviderProfile? profile;
  final List<ProviderApplication> applications;

  /// Scripted failure for the next call to a method (by name), used once.
  final Map<String, AppException> failures = {};

  final saved = <ProviderProfileInput>[];
  final applied = <({String categorySlug, String citySlug, String language})>[];
  final listLanguages = <String>[];
  final withdrawn = <String>[];
  final resubmitted = <String>[];
  var submitCalls = 0;
  var profileFetches = 0;
  var _ids = 0;

  /// Categories the fake server knows, to fill in application details.
  final catalogue = {
    'plumbing': category('plumbing', 'Plumbing'),
    'cleaning': category(
      'cleaning',
      'Cleaning',
      pricingModel: PricingModel.hourly,
    ),
    'ac-repair': category(
      'ac-repair',
      'AC Repair',
      pricingModel: PricingModel.fixed,
    ),
  };

  void _maybeFail(String method) {
    final failure = failures.remove(method);
    if (failure != null) throw failure;
  }

  @override
  Future<ProviderProfile?> fetchProfile() async {
    profileFetches += 1;
    _maybeFail('fetchProfile');
    return profile;
  }

  @override
  Future<ProviderProfile> saveProfile(ProviderProfileInput input) async {
    _maybeFail('saveProfile');
    saved.add(input);
    final current = profile;
    profile = ProviderProfile(
      id: current?.id ?? 'profile-1',
      fullName: input.fullName.trim(),
      bio: input.bio,
      yearsOfExperience: input.yearsOfExperience,
      verificationStatus:
          current?.verificationStatus ?? VerificationStatus.draft,
      reviewNote: current?.reviewNote,
    );
    return profile!;
  }

  @override
  Future<ProviderProfile> submitProfile() async {
    submitCalls += 1;
    _maybeFail('submitProfile');
    final current = profile!;
    profile = ProviderProfile(
      id: current.id,
      fullName: current.fullName,
      bio: current.bio,
      yearsOfExperience: current.yearsOfExperience,
      verificationStatus: VerificationStatus.submitted,
    );
    return profile!;
  }

  @override
  Future<List<ProviderApplication>> listApplications({
    required String language,
  }) async {
    listLanguages.add(language);
    _maybeFail('listApplications');
    return List.unmodifiable(applications);
  }

  @override
  Future<ProviderApplication> apply({
    required String categorySlug,
    required String citySlug,
    required String language,
  }) async {
    applied.add((
      categorySlug: categorySlug,
      citySlug: citySlug,
      language: language,
    ));
    _maybeFail('apply:$categorySlug');
    if (profile == null) {
      throw const ApiException(
        'x',
        statusCode: 409,
        code: 'PROVIDER_PROFILE_REQUIRED',
      );
    }
    if (applications.any(
      (a) => a.categorySlug == categorySlug && a.citySlug == citySlug,
    )) {
      throw const ApiException('x', statusCode: 409, code: 'ALREADY_APPLIED');
    }
    final category = catalogue[categorySlug];
    if (category == null) throw const NotFoundException('Not found.');
    _ids += 1;
    final application = ProviderApplication(
      id: 'app-$_ids',
      status: ApplicationStatus.pending,
      categoryId: category.id,
      categorySlug: category.slug,
      categoryName: category.name,
      pricingModel: category.pricingModel,
      citySlug: citySlug,
      cityName: citySlug == 'kandy' ? 'Kandy' : 'Colombo',
    );
    applications.add(application);
    return application;
  }

  @override
  Future<ProviderApplication> resubmit(
    String applicationId, {
    required String language,
  }) async {
    resubmitted.add(applicationId);
    _maybeFail('resubmit');
    final index = applications.indexWhere((a) => a.id == applicationId);
    if (index == -1) throw const NotFoundException('Not found.');
    final old = applications[index];
    if (old.status != ApplicationStatus.rejected) {
      throw const ApiException('x', statusCode: 409, code: 'INVALID_STATE');
    }
    return applications[index] = ProviderApplication(
      id: old.id,
      status: ApplicationStatus.pending,
      categoryId: old.categoryId,
      categorySlug: old.categorySlug,
      categoryName: old.categoryName,
      pricingModel: old.pricingModel,
      citySlug: old.citySlug,
      cityName: old.cityName,
    );
  }

  @override
  Future<void> withdraw(String applicationId) async {
    withdrawn.add(applicationId);
    _maybeFail('withdraw');
    applications.removeWhere((a) => a.id == applicationId);
  }
}

/// An application in a given state, for arranging screens.
ProviderApplication applicationOf(
  String slug,
  String name,
  ApplicationStatus status, {
  String? note,
  PricingModel pricingModel = PricingModel.quote,
}) => ProviderApplication(
  id: 'app-$slug',
  status: status,
  reviewNote: note,
  categoryId: 'id-$slug',
  categorySlug: slug,
  categoryName: name,
  pricingModel: pricingModel,
  citySlug: 'colombo',
  cityName: 'Colombo',
);

ProviderProfile profileOf(
  VerificationStatus status, {
  String name = 'Nimal Perera',
  String? note,
}) => ProviderProfile(
  id: 'profile-1',
  fullName: name,
  bio: 'Fifteen years of plumbing.',
  yearsOfExperience: 15,
  verificationStatus: status,
  reviewNote: note,
);
