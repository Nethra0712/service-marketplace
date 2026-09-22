import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/provider/application/provider_providers.dart';
import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';

import '../../../helpers/catalogue_fakes.dart';
import '../../../helpers/fakes.dart';

void main() {
  late FakeProviderRepository repo;
  late AuthHarness h;
  late ProviderContainer c;

  setUp(() async {
    repo = FakeProviderRepository(profile: profileOf(VerificationStatus.draft));
    h = AuthHarness(
      extraOverrides: [providerRepositoryProvider.overrideWithValue(repo)],
    );
    c = h.container;
    // Let the launch-time session check finish, so it cannot restart the
    // controllers under test halfway through.
    await c.read(authControllerProvider.notifier).ready;
  });
  tearDown(() => h.dispose());

  /// Keeps an auto-dispose provider alive for the length of the test.
  void keepAlive(ProviderListenable<Object?> provider) {
    final sub = c.listen(provider, (_, _) {});
    addTearDown(sub.close);
  }

  group('ProviderProfileController', () {
    test('loads the profile, or null when there is none', () async {
      keepAlive(providerProfileProvider);
      expect(
        (await c.read(providerProfileProvider.future))!.fullName,
        'Nimal Perera',
      );

      c.invalidate(providerProfileProvider);
      repo.profile = null;
      expect(await c.read(providerProfileProvider.future), isNull);
    });

    test('save replaces the loaded profile with the saved one', () async {
      keepAlive(providerProfileProvider);
      await c.read(providerProfileProvider.future);

      final saved = await c
          .read(providerProfileProvider.notifier)
          .save(const ProviderProfileInput(fullName: 'Nimal P.'));

      expect(saved.fullName, 'Nimal P.');
      expect(c.read(providerProfileProvider).value!.fullName, 'Nimal P.');
    });

    test('a failed save throws and leaves the loaded profile alone', () async {
      keepAlive(providerProfileProvider);
      await c.read(providerProfileProvider.future);
      repo.failures['saveProfile'] = const NetworkException('offline');

      await expectLater(
        c
            .read(providerProfileProvider.notifier)
            .save(const ProviderProfileInput(fullName: 'Changed')),
        throwsA(isA<NetworkException>()),
      );

      expect(c.read(providerProfileProvider).value!.fullName, 'Nimal Perera');
      expect(c.read(providerProfileProvider).hasError, isFalse);
    });

    test('submit moves the profile to submitted', () async {
      keepAlive(providerProfileProvider);
      await c.read(providerProfileProvider.future);

      await c.read(providerProfileProvider.notifier).submit();

      expect(
        c.read(providerProfileProvider).value!.verificationStatus,
        VerificationStatus.submitted,
      );
    });

    test(
      'a failed load is an error state, and is not retried on its own',
      () async {
        repo.failures['fetchProfile'] = const NetworkException('offline');
        keepAlive(providerProfileProvider);

        await expectLater(
          c.read(providerProfileProvider.future),
          throwsA(isA<NetworkException>()),
        );
        await Future<void>.delayed(const Duration(seconds: 1));

        expect(repo.profileFetches, 1);
      },
    );
  });

  group('ApplicationsController', () {
    Future<void> loaded() async {
      keepAlive(applicationsProvider);
      await c.read(applicationsProvider.future);
    }

    test('loads the applications in the current language', () async {
      repo.applications.add(
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.approved),
      );

      await loaded();

      expect(
        c.read(applicationsProvider).value!.single.categorySlug,
        'plumbing',
      );
      expect(repo.listLanguages.single, 'en');
    });

    test('applyMany adds each new application as pending', () async {
      await loaded();

      final outcome = await c
          .read(applicationsProvider.notifier)
          .applyMany(
            citySlug: 'colombo',
            categorySlugs: ['plumbing', 'cleaning'],
          );

      expect(outcome.applied, ['plumbing', 'cleaning']);
      expect(outcome.hasFailures, isFalse);
      expect(
        c.read(applicationsProvider).value!.map((a) => a.status),
        everyElement(ApplicationStatus.pending),
      );
    });

    test('applyMany reports each failure and still applies the rest', () async {
      await loaded();
      repo.failures['apply:plumbing'] = const ApiException(
        'x',
        statusCode: 409,
        code: 'ALREADY_APPLIED',
      );

      final outcome = await c
          .read(applicationsProvider.notifier)
          .applyMany(
            citySlug: 'colombo',
            categorySlugs: ['plumbing', 'cleaning', 'ac-repair'],
          );

      expect(outcome.applied, ['cleaning', 'ac-repair']);
      expect(outcome.failed.keys, ['plumbing']);
      expect(
        (outcome.failed['plumbing'] as ApiException).code,
        'ALREADY_APPLIED',
      );
      expect(c.read(applicationsProvider).value!.map((a) => a.categorySlug), [
        'cleaning',
        'ac-repair',
      ]);
    });

    test(
      'applying twice: the second is reported, no duplicate row appears',
      () async {
        await loaded();
        final notifier = c.read(applicationsProvider.notifier);
        await notifier.applyMany(
          citySlug: 'colombo',
          categorySlugs: ['plumbing'],
        );

        final second = await notifier.applyMany(
          citySlug: 'colombo',
          categorySlugs: ['plumbing'],
        );

        expect(second.applied, isEmpty);
        expect(
          (second.failed['plumbing'] as ApiException).code,
          'ALREADY_APPLIED',
        );
        expect(c.read(applicationsProvider).value, hasLength(1));
      },
    );

    test(
      'the same category in another city is a separate application',
      () async {
        await loaded();
        final notifier = c.read(applicationsProvider.notifier);

        await notifier.applyMany(
          citySlug: 'colombo',
          categorySlugs: ['plumbing'],
        );
        final kandyOutcome = await notifier.applyMany(
          citySlug: 'kandy',
          categorySlugs: ['plumbing'],
        );

        expect(kandyOutcome.applied, ['plumbing']);
        expect(c.read(applicationsProvider).value, hasLength(2));
      },
    );

    test('applying without a provider profile is refused', () async {
      repo.profile = null;
      await loaded();

      final outcome = await c
          .read(applicationsProvider.notifier)
          .applyMany(citySlug: 'colombo', categorySlugs: ['plumbing']);

      expect(outcome.applied, isEmpty);
      expect(
        (outcome.failed['plumbing'] as ApiException).code,
        'PROVIDER_PROFILE_REQUIRED',
      );
    });

    test(
      'an unknown category is a not-found failure for that category only',
      () async {
        await loaded();

        final outcome = await c
            .read(applicationsProvider.notifier)
            .applyMany(
              citySlug: 'colombo',
              categorySlugs: ['nope', 'plumbing'],
            );

        expect(outcome.failed['nope'], isA<NotFoundException>());
        expect(outcome.applied, ['plumbing']);
      },
    );

    test('resubmit updates the application in place', () async {
      repo.applications.addAll([
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.rejected),
        applicationOf('cleaning', 'Cleaning', ApplicationStatus.approved),
      ]);
      await loaded();

      await c.read(applicationsProvider.notifier).resubmit('app-plumbing');

      final byId = {
        for (final a in c.read(applicationsProvider).value!) a.id: a.status,
      };
      expect(byId, {
        'app-plumbing': ApplicationStatus.pending,
        'app-cleaning': ApplicationStatus.approved,
      });
    });

    test('a refused resubmit throws and changes nothing', () async {
      repo.applications.add(
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.approved),
      );
      await loaded();

      await expectLater(
        c.read(applicationsProvider.notifier).resubmit('app-plumbing'),
        throwsA(
          isA<ApiException>().having((e) => e.code, 'code', 'INVALID_STATE'),
        ),
      );

      expect(
        c.read(applicationsProvider).value!.single.status,
        ApplicationStatus.approved,
      );
    });

    test('withdraw removes only that application', () async {
      repo.applications.addAll([
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
        applicationOf('cleaning', 'Cleaning', ApplicationStatus.pending),
      ]);
      await loaded();

      await c.read(applicationsProvider.notifier).withdraw('app-plumbing');

      expect(c.read(applicationsProvider).value!.map((a) => a.categorySlug), [
        'cleaning',
      ]);
    });

    test('a failed withdraw keeps the application', () async {
      repo.applications.add(
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
      );
      await loaded();
      repo.failures['withdraw'] = const NetworkException('offline');

      await expectLater(
        c.read(applicationsProvider.notifier).withdraw('app-plumbing'),
        throwsA(isA<NetworkException>()),
      );

      expect(c.read(applicationsProvider).value, hasLength(1));
    });

    test(
      'applying before the list has loaded never hides existing applications',
      () async {
        repo.applications.add(
          applicationOf('plumbing', 'Plumbing', ApplicationStatus.approved),
        );
        // Hold the first load open so the list is genuinely not loaded yet.
        final gate = Completer<void>();
        final slowRepo = _SlowListRepository(repo, gate.future);
        final slow = AuthHarness(
          extraOverrides: [
            providerRepositoryProvider.overrideWithValue(slowRepo),
          ],
        );
        addTearDown(slow.dispose);
        final sub = slow.container.listen(applicationsProvider, (_, _) {});
        addTearDown(sub.close);

        final outcome = await slow.container
            .read(applicationsProvider.notifier)
            .applyMany(citySlug: 'colombo', categorySlugs: ['cleaning']);
        gate.complete();
        final list = await slow.container.read(applicationsProvider.future);

        expect(outcome.applied, ['cleaning']);
        // The pre-existing approval is still there next to the new one.
        expect(list.map((a) => a.categorySlug).toSet(), {
          'plumbing',
          'cleaning',
        });
      },
    );
  });
}

/// Delays the first listing, to test acting before it arrives.
class _SlowListRepository extends FakeProviderRepository {
  _SlowListRepository(FakeProviderRepository source, this._gate)
    : super(profile: source.profile, applications: source.applications);

  final Future<void> _gate;
  var _first = true;

  @override
  Future<List<ProviderApplication>> listApplications({
    required String language,
  }) async {
    if (_first) {
      _first = false;
      await _gate;
    }
    return super.listApplications(language: language);
  }
}
