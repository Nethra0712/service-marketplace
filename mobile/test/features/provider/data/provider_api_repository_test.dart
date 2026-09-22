import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/config/app_environment.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/dio_factory.dart';
import 'package:mobile/features/provider/data/provider_api_repository.dart';
import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

import '../../../helpers/fake_http.dart';

const _config = AppConfig(
  environment: AppEnvironment.dev,
  apiBaseUrl: 'http://localhost:3000',
  enableNetworkLogging: false,
);

// Bodies shaped exactly like the backend's responses.
const _profileJson = {
  'id': '22222222-2222-4222-8222-222222222222',
  'fullName': 'Nimal Perera',
  'bio': 'Fifteen years of plumbing.',
  'yearsOfExperience': 15,
  'verificationStatus': 'draft',
  'submittedAt': null,
  'reviewedAt': null,
  'reviewNote': null,
  'availability': 'offline',
  'createdAt': '2026-01-01T12:00:00.000Z',
  'updatedAt': '2026-01-01T12:00:00.000Z',
};

const _applicationJson = {
  'id': '33333333-3333-4333-8333-333333333333',
  'status': 'pending',
  'reviewNote': null,
  'reviewedAt': null,
  'category': {
    'id': '11111111-1111-4111-8111-111111111111',
    'slug': 'plumbing',
    'name': 'Plumbing',
    'pricingModel': 'quote',
  },
  'city': {'slug': 'colombo', 'name': 'Colombo'},
  'createdAt': '2026-01-01T12:00:00.000Z',
  'updatedAt': '2026-01-01T12:00:00.000Z',
};

(ProviderApiRepository, FakeAdapter) _repo(
  Future<ResponseBody> Function(RequestOptions) handler,
) {
  final adapter = FakeAdapter(handler);
  final dio = createDio(config: _config, readAccessToken: () async => 'tok')
    ..httpClientAdapter = adapter;
  return (ProviderApiRepository(ApiClient(dio)), adapter);
}

void main() {
  group('fetchProfile', () {
    test('parses the profile', () async {
      final (repo, http) = _repo((_) async => jsonBody(_profileJson));

      final profile = await repo.fetchProfile();

      expect(profile!.fullName, 'Nimal Perera');
      expect(profile.yearsOfExperience, 15);
      expect(profile.verificationStatus, VerificationStatus.draft);
      expect(profile.canSubmit, isTrue);
      expect(http.lastRequest!.path, '/api/provider/profile');
      expect(http.authorizations.single, 'Bearer tok');
    });

    test('no profile yet is null, not an error', () async {
      final (repo, _) = _repo(
        (_) async => errorBody(404, 'PROVIDER_PROFILE_NOT_FOUND'),
      );

      expect(await repo.fetchProfile(), isNull);
    });

    test('any other 404 is still an error', () async {
      final (repo, _) = _repo((_) async => errorBody(404, 'NOT_FOUND'));

      await expectLater(repo.fetchProfile(), throwsA(isA<NotFoundException>()));
    });

    test('parses review details on a rejected profile', () async {
      final (repo, _) = _repo(
        (_) async => jsonBody({
          ..._profileJson,
          'verificationStatus': 'rejected',
          'submittedAt': '2026-01-02T10:00:00.000Z',
          'reviewedAt': '2026-01-03T10:00:00.000Z',
          'reviewNote': 'Please add your experience.',
        }),
      );

      final profile = (await repo.fetchProfile())!;

      expect(profile.verificationStatus, VerificationStatus.rejected);
      expect(profile.reviewNote, 'Please add your experience.');
      expect(profile.reviewedAt, DateTime.utc(2026, 1, 3, 10));
      expect(profile.canSubmit, isTrue);
    });

    test('an unknown verification status is reported', () async {
      final (repo, _) = _repo(
        (_) async =>
            jsonBody({..._profileJson, 'verificationStatus': 'approved'}),
      );

      await expectLater(repo.fetchProfile(), throwsA(isA<UnknownException>()));
    });

    test('a 401 is surfaced as UnauthorizedException', () async {
      final (repo, _) = _repo((_) async => errorBody(401, 'UNAUTHENTICATED'));

      await expectLater(
        repo.fetchProfile(),
        throwsA(isA<UnauthorizedException>()),
      );
    });
  });

  group('saveProfile', () {
    test('PUTs only the provider-editable fields, trimmed', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody(_profileJson, status: 201),
      );

      await repo.saveProfile(
        const ProviderProfileInput(
          fullName: '  Nimal Perera ',
          bio: '  Fifteen years of plumbing. ',
          yearsOfExperience: 15,
        ),
      );

      expect(http.lastRequest!.method, 'PUT');
      expect(http.lastRequest!.path, '/api/provider/profile');
      // Exactly these keys: never a status, a user id, or anything else.
      expect(http.lastRequest!.data, {
        'fullName': 'Nimal Perera',
        'bio': 'Fifteen years of plumbing.',
        'yearsOfExperience': 15,
      });
    });

    test(
      'a blank bio and missing years are sent as null to clear them',
      () async {
        final (repo, http) = _repo((_) async => jsonBody(_profileJson));

        await repo.saveProfile(
          const ProviderProfileInput(fullName: 'Nimal', bio: '   '),
        );

        expect(http.lastRequest!.data, {
          'fullName': 'Nimal',
          'bio': null,
          'yearsOfExperience': null,
        });
      },
    );

    test('a validation failure carries its code', () async {
      final (repo, _) = _repo((_) async => errorBody(400, 'VALIDATION_ERROR'));

      await expectLater(
        repo.saveProfile(const ProviderProfileInput(fullName: 'x')),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'status', 400)
              .having((e) => e.code, 'code', 'VALIDATION_ERROR'),
        ),
      );
    });
  });

  test('submitProfile POSTs to the submit route', () async {
    final (repo, http) = _repo(
      (_) async =>
          jsonBody({..._profileJson, 'verificationStatus': 'submitted'}),
    );

    final profile = await repo.submitProfile();

    expect(http.lastRequest!.method, 'POST');
    expect(http.lastRequest!.path, '/api/provider/profile/submit');
    expect(profile.verificationStatus, VerificationStatus.submitted);
    expect(profile.canSubmit, isFalse);
  });

  test('an incomplete profile is reported with its code', () async {
    final (repo, _) = _repo((_) async => errorBody(409, 'PROFILE_INCOMPLETE'));

    await expectLater(
      repo.submitProfile(),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'PROFILE_INCOMPLETE'),
      ),
    );
  });

  group('applications', () {
    test('listApplications parses category, city and status', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody({
          'items': [
            _applicationJson,
            {..._applicationJson, 'id': 'b', 'status': 'suspended'},
          ],
        }),
      );

      final items = await repo.listApplications(language: 'ta');

      expect(items.map((a) => a.status), [
        ApplicationStatus.pending,
        ApplicationStatus.suspended,
      ]);
      expect(items.first.categorySlug, 'plumbing');
      expect(items.first.pricingModel, PricingModel.quote);
      expect(items.first.cityName, 'Colombo');
      expect(http.lastRequest!.queryParameters, {'lang': 'ta'});
    });

    test('apply sends the category and city slugs', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody(_applicationJson, status: 201),
      );

      final application = await repo.apply(
        categorySlug: 'plumbing',
        citySlug: 'colombo',
        language: 'en',
      );

      expect(application.status, ApplicationStatus.pending);
      expect(http.lastRequest!.method, 'POST');
      expect(http.lastRequest!.path, '/api/provider/services');
      expect(http.lastRequest!.data, {
        'categorySlug': 'plumbing',
        'citySlug': 'colombo',
      });
    });

    test('applying twice is reported as ALREADY_APPLIED', () async {
      final (repo, _) = _repo((_) async => errorBody(409, 'ALREADY_APPLIED'));

      await expectLater(
        repo.apply(
          categorySlug: 'plumbing',
          citySlug: 'colombo',
          language: 'en',
        ),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'status', 409)
              .having((e) => e.code, 'code', 'ALREADY_APPLIED'),
        ),
      );
    });

    test('resubmit and withdraw use the application id', () async {
      final (repo, http) = _repo((options) async {
        return options.method == 'DELETE'
            ? ResponseBody.fromString('', 204)
            : jsonBody(_applicationJson);
      });

      await repo.resubmit('abc', language: 'en');
      expect(http.lastRequest!.method, 'POST');
      expect(http.lastRequest!.path, '/api/provider/services/abc/resubmit');

      await repo.withdraw('abc');
      expect(http.lastRequest!.method, 'DELETE');
      expect(http.lastRequest!.path, '/api/provider/services/abc');
    });

    test('permissions per state', () {
      ProviderApplication of(ApplicationStatus status) =>
          ProviderApplication.fromJson({
            ..._applicationJson,
            'status': status.name,
          });

      expect(of(ApplicationStatus.pending).canWithdraw, isTrue);
      expect(of(ApplicationStatus.pending).canResubmit, isFalse);
      expect(of(ApplicationStatus.rejected).canWithdraw, isTrue);
      expect(of(ApplicationStatus.rejected).canResubmit, isTrue);
      // Decisions the platform owns cannot be undone by the provider.
      expect(of(ApplicationStatus.approved).canWithdraw, isFalse);
      expect(of(ApplicationStatus.approved).canResubmit, isFalse);
      expect(of(ApplicationStatus.suspended).canWithdraw, isFalse);
      expect(of(ApplicationStatus.suspended).canResubmit, isFalse);
    });
  });
}
