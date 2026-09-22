import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/config/app_environment.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/dio_factory.dart';
import 'package:mobile/features/services/data/catalogue_api_repository.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

import '../../../helpers/fake_http.dart';

const _config = AppConfig(
  environment: AppEnvironment.dev,
  apiBaseUrl: 'http://localhost:3000',
  enableNetworkLogging: false,
);

// Bodies shaped exactly like the backend's responses.
const _categoryJson = {
  'id': '11111111-1111-4111-8111-111111111111',
  'slug': 'plumbing',
  'name': 'Plumbing',
  'description': 'Leaks, blocked drains, taps, pipes and bathroom fittings.',
  'pricingModel': 'quote',
};
const _cityJson = {
  'slug': 'colombo',
  'name': 'Colombo',
  'countryCode': 'LK',
  'timezone': 'Asia/Colombo',
  'currency': 'LKR',
};

(CatalogueApiRepository, FakeAdapter) _repo(
  Future<ResponseBody> Function(RequestOptions) handler,
) {
  final adapter = FakeAdapter(handler);
  final dio = createDio(config: _config, readAccessToken: () async => null)
    ..httpClientAdapter = adapter;
  return (CatalogueApiRepository(ApiClient(dio)), adapter);
}

void main() {
  group('listCategories', () {
    test('asks in the given language and parses the items', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody({
          'language': 'si',
          'items': [_categoryJson],
        }),
      );

      final items = await repo.listCategories(language: 'si');

      expect(items, hasLength(1));
      expect(items.single.slug, 'plumbing');
      expect(items.single.pricingModel, PricingModel.quote);
      expect(items.single.description, startsWith('Leaks'));
      expect(http.lastRequest!.path, '/api/service-categories');
      expect(http.lastRequest!.queryParameters, {'lang': 'si'});
    });

    test('sends only the filters that are set, trimmed', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody({'language': 'en', 'items': <Object>[]}),
      );

      await repo.listCategories(
        language: 'en',
        search: '  drain ',
        pricingModel: PricingModel.hourly,
        citySlug: 'colombo',
      );

      expect(http.lastRequest!.queryParameters, {
        'lang': 'en',
        'q': 'drain',
        'pricingModel': 'hourly',
        'city': 'colombo',
      });
    });

    test('leaves out a blank search rather than sending q=', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody({'language': 'en', 'items': <Object>[]}),
      );

      await repo.listCategories(language: 'en', search: '   ');

      expect(http.lastRequest!.queryParameters.containsKey('q'), isFalse);
    });

    test('a category without a description is fine', () async {
      final (repo, _) = _repo(
        (_) async => jsonBody({
          'language': 'en',
          'items': [
            {..._categoryJson, 'description': null},
          ],
        }),
      );

      expect(
        (await repo.listCategories(language: 'en')).single.description,
        isNull,
      );
    });

    test('an unknown pricing model is reported, not guessed', () async {
      final (repo, _) = _repo(
        (_) async => jsonBody({
          'items': [
            {..._categoryJson, 'pricingModel': 'barter'},
          ],
        }),
      );

      await expectLater(
        repo.listCategories(language: 'en'),
        throwsA(isA<UnknownException>()),
      );
    });

    test('a missing field is reported as an unexpected response', () async {
      final (repo, _) = _repo(
        (_) async => jsonBody({
          'items': [
            {'id': 'x', 'slug': 'plumbing'},
          ],
        }),
      );

      await expectLater(
        repo.listCategories(language: 'en'),
        throwsA(isA<UnknownException>()),
      );
    });

    test('an HTML error page is reported, not crashed on', () async {
      final (repo, _) = _repo(
        (_) async => ResponseBody.fromString('<html>oops</html>', 200),
      );

      await expectLater(
        repo.listCategories(language: 'en'),
        throwsA(isA<UnknownException>()),
      );
    });

    test('a server error becomes ServerException', () async {
      final (repo, _) = _repo((_) async => errorBody(500, 'INTERNAL_ERROR'));

      await expectLater(
        repo.listCategories(language: 'en'),
        throwsA(isA<ServerException>()),
      );
    });
  });

  group('getCategory', () {
    test('parses cities and the available provider count', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody({
          'language': 'en',
          ..._categoryJson,
          'cities': [_cityJson],
          'availableProviderCount': 3,
        }),
      );

      final detail = await repo.getCategory('plumbing', language: 'en');

      expect(detail.category.name, 'Plumbing');
      expect(detail.cities.single.name, 'Colombo');
      expect(detail.cities.single.currency, 'LKR');
      expect(detail.availableProviderCount, 3);
      expect(http.lastRequest!.path, '/api/service-categories/plumbing');
    });

    test('encodes the slug in the path', () async {
      final (repo, http) = _repo((_) async => errorBody(404, 'NOT_FOUND'));

      await expectLater(
        repo.getCategory('a/b?c', language: 'en'),
        throwsA(isA<NotFoundException>()),
      );

      expect(http.lastRequest!.uri.path, '/api/service-categories/a%2Fb%3Fc');
    });

    test('an inactive or unknown category is a NotFoundException', () async {
      final (repo, _) = _repo((_) async => errorBody(404, 'NOT_FOUND'));

      await expectLater(
        repo.getCategory('carpentry', language: 'en'),
        throwsA(isA<NotFoundException>()),
      );
    });
  });

  test('listCities parses the cities', () async {
    final (repo, http) = _repo(
      (_) async => jsonBody({
        'items': [_cityJson],
      }),
    );

    final cities = await repo.listCities();

    expect(cities.single.slug, 'colombo');
    expect(cities.single.timezone, 'Asia/Colombo');
    expect(http.lastRequest!.path, '/api/cities');
  });

  test('no request carries credentials when none are supplied', () async {
    final (repo, http) = _repo((_) async => jsonBody({'items': <Object>[]}));

    await repo.listCities();

    expect(http.authorizations.single, isNull);
  });
}
