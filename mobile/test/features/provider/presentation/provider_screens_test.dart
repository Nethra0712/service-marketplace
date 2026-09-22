import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/locale_provider.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/provider/application/provider_providers.dart';
import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';

import '../../../helpers/catalogue_fakes.dart';
import '../../../helpers/fakes.dart';
import '../../../helpers/feature_harness.dart';
import '../../../helpers/pump_app.dart';

void main() {
  final en = lookupAppLocalizations(const Locale('en'));
  final si = lookupAppLocalizations(const Locale('si'));
  final ta = lookupAppLocalizations(const Locale('ta'));

  late FeatureHarness f;
  setUp(() => f = FeatureHarness());
  tearDown(() => f.dispose());

  Finder key(String value) => find.byKey(Key(value));

  /// A screen tall enough to build every card of a long list at once.
  void tallScreen(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  Future<void> tapKey(WidgetTester tester, String value) async {
    await tester.ensureVisible(key(value));
    await tester.tap(key(value));
    await settle(tester);
  }

  Future<void> fillProfile(
    WidgetTester tester, {
    String name = 'Nimal Perera',
    String years = '',
    String bio = '',
  }) async {
    await tester.enterText(key('full_name_field'), name);
    await tester.enterText(key('years_field'), years);
    await tester.enterText(key('bio_field'), bio);
  }

  // ---------------------------------------------------------------- hub ---

  group('provider area', () {
    testWidgets('someone with no profile is invited to create one', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.provider.path);

      expect(find.text(en.providerIntroTitle), findsOneWidget);
      expect(key('setup_profile_button'), findsOneWidget);
      expect(key('verification_status'), findsNothing);
    });

    testWidgets('is reachable from the home screen', (tester) async {
      await f.open(tester);

      await tester.tap(key('provider_area_button'));
      await settle(tester);

      expect(find.text(en.providerIntroTitle), findsOneWidget);
    });

    for (final (status, label, help, canSubmit) in [
      (
        VerificationStatus.draft,
        en.verificationDraft,
        en.verificationDraftHelp,
        true,
      ),
      (
        VerificationStatus.submitted,
        en.verificationSubmitted,
        en.verificationSubmittedHelp,
        false,
      ),
      (
        VerificationStatus.verified,
        en.verificationVerified,
        en.verificationVerifiedHelp,
        false,
      ),
      (
        VerificationStatus.rejected,
        en.verificationRejected,
        en.verificationRejectedHelp,
        true,
      ),
    ]) {
      testWidgets('shows a ${status.name} profile: "$label"', (tester) async {
        f.provider.profile = profileOf(status);

        await f.open(tester, AppRoutes.provider.path);

        expect(find.text('Nimal Perera'), findsOneWidget);
        expect(find.text(label), findsOneWidget);
        expect(find.text(help), findsOneWidget);
        // Only a draft or rejected profile can be handed in.
        expect(
          key('submit_profile_button'),
          canSubmit ? findsOneWidget : findsNothing,
        );
      });
    }

    testWidgets('a rejected profile shows the reviewer\'s note', (
      tester,
    ) async {
      f.provider.profile = profileOf(
        VerificationStatus.rejected,
        note: 'Please add your experience.',
      );

      await f.open(tester, AppRoutes.provider.path);

      expect(
        find.text(en.providerReviewNote('Please add your experience.')),
        findsOneWidget,
      );
    });

    testWidgets('a note on a profile that is not rejected is not shown', (
      tester,
    ) async {
      f.provider.profile = profileOf(
        VerificationStatus.submitted,
        note: 'stale note',
      );

      await f.open(tester, AppRoutes.provider.path);

      expect(key('review_note'), findsNothing);
    });

    testWidgets('submitting hands the profile in for review', (tester) async {
      f.provider.profile = profileOf(VerificationStatus.draft);
      await f.open(tester, AppRoutes.provider.path);

      await tapKey(tester, 'submit_profile_button');

      expect(f.provider.submitCalls, 1);
      expect(find.text(en.providerSubmitted), findsOneWidget); // snackbar
      expect(find.text(en.verificationSubmitted), findsOneWidget);
      expect(key('submit_profile_button'), findsNothing);
    });

    testWidgets('an incomplete profile is told what is missing', (
      tester,
    ) async {
      f.provider.profile = profileOf(VerificationStatus.draft);
      f.provider.failures['submitProfile'] = const ApiException(
        'x',
        statusCode: 409,
        code: 'PROFILE_INCOMPLETE',
      );
      await f.open(tester, AppRoutes.provider.path);

      await tapKey(tester, 'submit_profile_button');

      expect(find.text(en.errorProfileIncomplete), findsOneWidget);
      // Still a draft, still submittable.
      expect(find.text(en.verificationDraft), findsOneWidget);
      expect(key('submit_profile_button'), findsOneWidget);
    });

    testWidgets('summarises the service applications', (tester) async {
      f.provider.profile = profileOf(VerificationStatus.draft);
      f.provider.applications.addAll([
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.approved),
        applicationOf('cleaning', 'Cleaning', ApplicationStatus.pending),
      ]);

      await f.open(tester, AppRoutes.provider.path);

      expect(find.text('2 service applications'), findsOneWidget);
    });

    testWidgets('a failure shows an error, retry loads the profile', (
      tester,
    ) async {
      f.provider.failures['fetchProfile'] = const NetworkException('offline');

      await f.open(tester, AppRoutes.provider.path);

      expect(find.text(en.errorNetwork), findsOneWidget);
      // Riverpod must not silently retry in the background.
      expect(f.provider.profileFetches, 1);

      await tester.tap(key('retry_button'));
      await settle(tester);

      expect(find.text(en.providerIntroTitle), findsOneWidget);
    });
  });

  // ------------------------------------------------------- profile form ---

  group('provider profile form', () {
    testWidgets('creates a profile and returns to the provider area', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.provider.path);
      await tapKey(tester, 'setup_profile_button');

      await fillProfile(tester, years: '15', bio: 'Fifteen years of plumbing.');
      await tapKey(tester, 'save_profile_button');

      final saved = f.provider.saved.single;
      expect(saved.fullName, 'Nimal Perera');
      expect(saved.yearsOfExperience, 15);
      expect(saved.bio, 'Fifteen years of plumbing.');
      expect(find.text(en.providerSaved), findsOneWidget);
      // Back on the provider area, now showing the new profile as a draft.
      expect(find.text('Nimal Perera'), findsOneWidget);
      expect(find.text(en.verificationDraft), findsOneWidget);
    });

    testWidgets('experience and about-you are optional', (tester) async {
      await f.open(tester, AppRoutes.providerProfile.path);

      await fillProfile(tester);
      await tapKey(tester, 'save_profile_button');

      final saved = f.provider.saved.single;
      expect(saved.yearsOfExperience, isNull);
      expect(saved.bio?.trim() ?? '', isEmpty);
    });

    testWidgets('editing starts from what is saved', (tester) async {
      f.provider.profile = profileOf(VerificationStatus.verified);
      await f.open(tester, AppRoutes.providerProfile.path);

      expect(
        tester.widget<TextFormField>(key('full_name_field')).controller!.text,
        'Nimal Perera',
      );
      expect(
        tester.widget<TextFormField>(key('years_field')).controller!.text,
        '15',
      );
      expect(
        tester.widget<TextFormField>(key('bio_field')).controller!.text,
        'Fifteen years of plumbing.',
      );
    });

    testWidgets('editing never changes the verification status', (
      tester,
    ) async {
      f.provider.profile = profileOf(VerificationStatus.verified);
      await f.open(tester, AppRoutes.providerProfile.path);

      await tester.enterText(key('full_name_field'), 'Nimal P.');
      await tapKey(tester, 'save_profile_button');

      expect(
        f.provider.profile!.verificationStatus,
        VerificationStatus.verified,
      );
    });

    testWidgets('a name is required', (tester) async {
      await f.open(tester, AppRoutes.providerProfile.path);

      await fillProfile(tester, name: '   ');
      await tapKey(tester, 'save_profile_button');

      expect(find.text(en.providerNameRequired), findsOneWidget);
      expect(f.provider.saved, isEmpty);
    });

    testWidgets('a name over 100 characters is refused', (tester) async {
      await f.open(tester, AppRoutes.providerProfile.path);

      await fillProfile(tester, name: 'x' * 101);
      await tapKey(tester, 'save_profile_button');

      expect(find.text(en.providerNameTooLong), findsOneWidget);
      expect(f.provider.saved, isEmpty);
    });

    testWidgets('experience must be 0 to 60', (tester) async {
      await f.open(tester, AppRoutes.providerProfile.path);

      await fillProfile(tester, years: '61');
      await tapKey(tester, 'save_profile_button');

      expect(find.text(en.providerYearsInvalid), findsOneWidget);
      expect(f.provider.saved, isEmpty);
    });

    testWidgets('the experience field only accepts digits', (tester) async {
      await f.open(tester, AppRoutes.providerProfile.path);

      await tester.enterText(key('years_field'), '1a2-');

      expect(
        tester.widget<TextFormField>(key('years_field')).controller!.text,
        '12',
      );
    });

    testWidgets('an about-you text over 1000 characters is refused', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.providerProfile.path);

      await fillProfile(tester, bio: 'x' * 1001);
      await tapKey(tester, 'save_profile_button');

      expect(find.text(en.providerBioTooLong), findsOneWidget);
      expect(f.provider.saved, isEmpty);
    });

    testWidgets('the boundary values are accepted', (tester) async {
      await f.open(tester, AppRoutes.providerProfile.path);

      await fillProfile(tester, name: 'n' * 100, years: '60', bio: 'b' * 1000);
      await tapKey(tester, 'save_profile_button');

      expect(f.provider.saved, hasLength(1));
    });

    testWidgets('zero years of experience is a real answer, not "blank"', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.providerProfile.path);

      await fillProfile(tester, years: '0');
      await tapKey(tester, 'save_profile_button');

      expect(f.provider.saved.single.yearsOfExperience, 0);
    });

    testWidgets('a network failure keeps the form and allows another try', (
      tester,
    ) async {
      f.provider.failures['saveProfile'] = const NetworkException('offline');
      await f.open(tester, AppRoutes.providerProfile.path);
      await fillProfile(tester);

      await tapKey(tester, 'save_profile_button');

      expect(find.text(en.errorNetwork), findsOneWidget);
      expect(key('full_name_field'), findsOneWidget);
      expect(
        tester.widget<TextFormField>(key('full_name_field')).controller!.text,
        'Nimal Perera',
      );

      await tapKey(tester, 'save_profile_button');

      expect(f.provider.saved, hasLength(1));
      expect(key('full_name_field'), findsNothing); // left the form
    });

    testWidgets('a server validation error is shown, not the server\'s text', (
      tester,
    ) async {
      f.provider.failures['saveProfile'] = const ApiException(
        'raw server text',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      );
      await f.open(tester, AppRoutes.providerProfile.path);
      await fillProfile(tester);

      await tapKey(tester, 'save_profile_button');

      expect(find.text(en.errorValidation), findsOneWidget);
      expect(find.textContaining('raw server text'), findsNothing);
    });
  });

  // -------------------------------------------------------------- apply ---

  group('apply for services', () {
    setUp(() {
      f.provider.profile = profileOf(VerificationStatus.draft);
    });

    testWidgets('lists the services offered in the city', (tester) async {
      await f.open(tester, AppRoutes.providerApply.path);

      expect(key('apply_category_plumbing'), findsOneWidget);
      expect(key('apply_category_cleaning'), findsOneWidget);
      expect(key('apply_category_ac-repair'), findsOneWidget);
      // One city: no picker needed.
      expect(key('city_dropdown'), findsNothing);
    });

    testWidgets('needs a provider profile first', (tester) async {
      f.provider.profile = null;

      await f.open(tester, AppRoutes.providerApply.path);

      expect(key('apply_needs_profile'), findsOneWidget);
      expect(find.text(en.providerApplyNeedProfile), findsOneWidget);
      expect(key('apply_category_plumbing'), findsNothing);

      await tester.tap(find.text(en.providerSetupProfile));
      await settle(tester);

      expect(key('full_name_field'), findsOneWidget);
    });

    testWidgets('nothing is selected at first, so the button is off', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.providerApply.path);

      expect(
        tester.widget<FilledButton>(key('apply_button')).onPressed,
        isNull,
      );
    });

    testWidgets('applies for several services and shows them as pending', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.providerApply.path);

      await tester.tap(key('apply_category_plumbing'));
      await tester.tap(key('apply_category_cleaning'));
      await tester.pump();
      expect(find.text(en.providerApplyButton(2)), findsOneWidget);

      await tapKey(tester, 'apply_button');

      expect(f.provider.applied.map((a) => (a.categorySlug, a.citySlug)), [
        ('plumbing', 'colombo'),
        ('cleaning', 'colombo'),
      ]);
      // Landed on the applications screen with both, awaiting review.
      expect(find.text(en.providerMyServices), findsOneWidget);
      expect(key('application_plumbing'), findsOneWidget);
      expect(key('application_cleaning'), findsOneWidget);
      expect(find.text(en.applicationPending), findsNWidgets(2));
    });

    testWidgets('services already applied for are not offered again', (
      tester,
    ) async {
      f.provider.applications.add(
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
      );

      await f.open(tester, AppRoutes.providerApply.path);

      expect(key('apply_category_plumbing'), findsNothing);
      expect(key('apply_category_cleaning'), findsOneWidget);
    });

    testWidgets('when every service has been applied for, says so', (
      tester,
    ) async {
      f.provider.applications.addAll([
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
        applicationOf('cleaning', 'Cleaning', ApplicationStatus.rejected),
        applicationOf('ac-repair', 'AC Repair', ApplicationStatus.approved),
      ]);

      await f.open(tester, AppRoutes.providerApply.path);

      expect(key('apply_nothing_left'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(key('apply_button')).onPressed,
        isNull,
      );
    });

    testWidgets('a service opened from its detail page is already ticked', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.serviceDetailLocation('cleaning'));

      await tester.tap(key('offer_service_button'));
      await settle(tester);

      expect(
        tester.widget<CheckboxListTile>(key('apply_category_cleaning')).value,
        isTrue,
      );
      expect(
        tester.widget<CheckboxListTile>(key('apply_category_plumbing')).value,
        isFalse,
      );
      expect(find.text(en.providerApplyButton(1)), findsOneWidget);
    });

    testWidgets(
      'a duplicate is reported on that service; the others go through',
      (tester) async {
        // Another device applied for "cleaning" after this screen loaded.
        f.provider.failures['apply:cleaning'] = const ApiException(
          'x',
          statusCode: 409,
          code: 'ALREADY_APPLIED',
        );
        await f.open(tester, AppRoutes.providerApply.path);
        await tester.tap(key('apply_category_plumbing'));
        await tester.tap(key('apply_category_cleaning'));
        await tester.pump();

        await tapKey(tester, 'apply_button');

        // Plumbing went through and left the list; cleaning explains itself.
        expect(f.provider.applications.map((a) => a.categorySlug), [
          'plumbing',
        ]);
        expect(key('apply_category_plumbing'), findsNothing);
        expect(key('apply_error_cleaning'), findsOneWidget);
        expect(find.text(en.errorAlreadyApplied), findsOneWidget);
        // Still on the apply screen: the failure is not buried.
        expect(key('apply_button'), findsOneWidget);
      },
    );

    testWidgets('a real duplicate from the server is reported the same way', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.providerApply.path);
      // The screen has not seen this application (it was made elsewhere).
      f.provider.applications.add(
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
      );
      await tester.tap(key('apply_category_plumbing'));
      await tester.pump();

      await tapKey(tester, 'apply_button');

      expect(find.text(en.errorAlreadyApplied), findsOneWidget);
      expect(f.provider.applications, hasLength(1)); // no second row
    });

    testWidgets('several cities: the choice of city decides what is sent', (
      tester,
    ) async {
      f = FeatureHarness(
        catalogue: FakeCatalogueRepository(cities: const [colombo, kandy]),
        provider: FakeProviderRepository(
          profile: profileOf(VerificationStatus.draft),
          applications: [
            applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
          ],
        ),
      );
      await f.open(tester, AppRoutes.providerApply.path);
      // Applied in Colombo, so hidden here...
      expect(key('apply_category_plumbing'), findsNothing);

      await tester.tap(key('city_dropdown'));
      await settle(tester);
      await tester.tap(find.text('Kandy').last);
      await settle(tester);

      // ...but eligibility is per city, so it is open in Kandy.
      expect(key('apply_category_plumbing'), findsOneWidget);

      await tester.tap(key('apply_category_plumbing'));
      await tester.pump();
      await tapKey(tester, 'apply_button');

      expect(f.provider.applied.single.citySlug, 'kandy');
    });

    testWidgets('a failure loading the services can be retried', (
      tester,
    ) async {
      f.catalogue.failWith = const NetworkException('offline');

      await f.open(tester, AppRoutes.providerApply.path);

      expect(find.text(en.errorNetwork), findsOneWidget);

      f.catalogue.failWith = null;
      await tester.tap(key('retry_button'));
      await settle(tester);

      expect(key('apply_category_plumbing'), findsOneWidget);
    });
  });

  // ------------------------------------------------------- applications ---

  group('service applications', () {
    Future<void> openWith(
      WidgetTester tester,
      List<ProviderApplication> applications, {
      VerificationStatus verification = VerificationStatus.verified,
    }) async {
      f.provider
        ..profile = profileOf(verification)
        ..applications.addAll(applications);
      await f.open(tester, AppRoutes.providerServices.path);
    }

    testWidgets('shows every approval state in words', (tester) async {
      tallScreen(tester);
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
        applicationOf('cleaning', 'Cleaning', ApplicationStatus.approved),
        applicationOf('ac-repair', 'AC Repair', ApplicationStatus.rejected),
        applicationOf('painting', 'Painting', ApplicationStatus.suspended),
      ]);

      for (final (slug, label, help) in [
        ('plumbing', en.applicationPending, en.applicationPendingHelp),
        ('cleaning', en.applicationApproved, en.applicationApprovedHelp),
        ('ac-repair', en.applicationRejected, en.applicationRejectedHelp),
        ('painting', en.applicationSuspended, en.applicationSuspendedHelp),
      ]) {
        final chip = key('application_status_$slug');
        expect(
          find.descendant(of: chip, matching: find.text(label)),
          findsOneWidget,
          reason: slug,
        );
        expect(find.text(help), findsOneWidget, reason: slug);
      }
    });

    testWidgets('names the city and pricing of each application', (
      tester,
    ) async {
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
      ]);

      expect(find.text('Colombo · ${en.pricingQuote}'), findsOneWidget);
    });

    testWidgets('a rejection shows the reviewer\'s note', (tester) async {
      await openWith(tester, [
        applicationOf(
          'plumbing',
          'Plumbing',
          ApplicationStatus.rejected,
          note: 'Need a certificate.',
        ),
      ]);

      expect(
        find.text(en.providerReviewNote('Need a certificate.')),
        findsOneWidget,
      );
    });

    testWidgets('offers only the actions each state allows', (tester) async {
      tallScreen(tester);
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
        applicationOf('cleaning', 'Cleaning', ApplicationStatus.approved),
        applicationOf('ac-repair', 'AC Repair', ApplicationStatus.rejected),
      ]);

      // Pending: withdraw only.
      expect(key('withdraw_plumbing'), findsOneWidget);
      expect(key('resubmit_plumbing'), findsNothing);
      // Approved: a platform decision, nothing to do.
      expect(key('withdraw_cleaning'), findsNothing);
      expect(key('resubmit_cleaning'), findsNothing);
      // Rejected: apply again, or withdraw.
      expect(key('resubmit_ac-repair'), findsOneWidget);
      expect(key('withdraw_ac-repair'), findsOneWidget);
    });

    testWidgets('a suspended service has no actions', (tester) async {
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.suspended),
      ]);

      expect(key('withdraw_plumbing'), findsNothing);
      expect(key('resubmit_plumbing'), findsNothing);
    });

    testWidgets('applying again after a rejection makes it pending', (
      tester,
    ) async {
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.rejected),
      ]);

      await tapKey(tester, 'resubmit_plumbing');

      expect(f.provider.resubmitted, ['app-plumbing']);
      expect(find.text(en.providerResubmitted), findsOneWidget);
      expect(
        find.descendant(
          of: key('application_status_plumbing'),
          matching: find.text(en.applicationPending),
        ),
        findsOneWidget,
      );
      expect(key('resubmit_plumbing'), findsNothing);
    });

    testWidgets('a refused resubmit explains itself and changes nothing', (
      tester,
    ) async {
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.rejected),
      ]);
      f.provider.failures['resubmit'] = const ApiException(
        'x',
        statusCode: 409,
        code: 'INVALID_STATE',
      );

      await tapKey(tester, 'resubmit_plumbing');

      expect(find.text(en.errorInvalidState), findsOneWidget);
      expect(key('resubmit_plumbing'), findsOneWidget);
    });

    testWidgets('withdrawing asks first, and cancelling keeps it', (
      tester,
    ) async {
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
      ]);

      await tapKey(tester, 'withdraw_plumbing');
      expect(find.text(en.providerWithdrawTitle), findsOneWidget);
      expect(find.text(en.providerWithdrawBody('Plumbing')), findsOneWidget);

      await tapKey(tester, 'withdraw_cancel');

      expect(f.provider.withdrawn, isEmpty);
      expect(key('application_plumbing'), findsOneWidget);
    });

    testWidgets('confirming a withdrawal removes the application', (
      tester,
    ) async {
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
        applicationOf('cleaning', 'Cleaning', ApplicationStatus.pending),
      ]);

      await tapKey(tester, 'withdraw_plumbing');
      await tapKey(tester, 'withdraw_confirm');

      expect(f.provider.withdrawn, ['app-plumbing']);
      expect(key('application_plumbing'), findsNothing);
      expect(key('application_cleaning'), findsOneWidget);
      expect(find.text(en.providerWithdrawn), findsOneWidget);
    });

    testWidgets('a failed withdrawal leaves the application in place', (
      tester,
    ) async {
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
      ]);
      f.provider.failures['withdraw'] = const NetworkException('offline');

      await tapKey(tester, 'withdraw_plumbing');
      await tapKey(tester, 'withdraw_confirm');

      expect(find.text(en.errorNetwork), findsOneWidget);
      expect(key('application_plumbing'), findsOneWidget);
    });

    testWidgets(
      'warns that approval is not enough until the profile is verified',
      (tester) async {
        await openWith(tester, [
          applicationOf('plumbing', 'Plumbing', ApplicationStatus.approved),
        ], verification: VerificationStatus.submitted);

        expect(key('verify_first_banner'), findsOneWidget);
        expect(find.text(en.providerVerifyFirst), findsOneWidget);
      },
    );

    testWidgets('no warning once the profile is verified', (tester) async {
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.approved),
      ]);

      expect(key('verify_first_banner'), findsNothing);
    });

    testWidgets('an empty list invites the provider to add services', (
      tester,
    ) async {
      await openWith(tester, []);

      expect(key('applications_empty'), findsOneWidget);
      expect(find.text(en.providerServicesSummary(0)), findsOneWidget);

      await tester.tap(find.text(en.providerAddServices).last);
      await settle(tester);

      expect(key('apply_button'), findsOneWidget);
    });

    testWidgets('a failure to load can be retried', (tester) async {
      f.provider.failures['listApplications'] = const NetworkException('x');
      await openWith(tester, [
        applicationOf('plumbing', 'Plumbing', ApplicationStatus.pending),
      ]);

      expect(find.text(en.errorNetwork), findsOneWidget);
      expect(key('application_plumbing'), findsNothing);

      await tester.tap(key('retry_button'));
      await settle(tester);

      expect(key('application_plumbing'), findsOneWidget);
    });
  });

  // ------------------------------------------------------- localization ---

  group('localization', () {
    testWidgets('the provider area and statuses follow the language', (
      tester,
    ) async {
      f.provider.profile = profileOf(VerificationStatus.draft);
      await f.open(tester, AppRoutes.provider.path);

      f.container.read(localeProvider.notifier).select(AppLocales.sinhala);
      await settle(tester);

      expect(find.text(si.providerAreaTitle), findsOneWidget);
      expect(find.text(si.verificationDraft), findsOneWidget);
      expect(find.text(si.providerSubmitForReview), findsOneWidget);
      expect(find.text(si.providerServicesSummary(0)), findsOneWidget);
    });

    testWidgets('application states are shown in Tamil', (tester) async {
      f.provider
        ..profile = profileOf(VerificationStatus.verified)
        ..applications.add(
          applicationOf('plumbing', 'Plumbing', ApplicationStatus.rejected),
        );
      await f.open(tester, AppRoutes.providerServices.path);

      f.container.read(localeProvider.notifier).select(AppLocales.tamil);
      await settle(tester);

      expect(find.text(ta.applicationRejected), findsOneWidget);
      expect(find.text(ta.applicationRejectedHelp), findsOneWidget);
      expect(find.text(ta.providerResubmit), findsOneWidget);
      expect(find.text(ta.providerWithdraw), findsOneWidget);
    });

    testWidgets('form validation messages follow the language', (tester) async {
      await f.open(tester, AppRoutes.providerProfile.path);
      f.container.read(localeProvider.notifier).select(AppLocales.sinhala);
      await settle(tester);

      await fillProfile(tester, name: '');
      await tapKey(tester, 'save_profile_button');

      expect(find.text(si.providerNameRequired), findsOneWidget);
      expect(find.text(si.providerFullNameLabel), findsOneWidget);
    });

    testWidgets('server error codes are shown in the chosen language', (
      tester,
    ) async {
      f.provider.profile = profileOf(VerificationStatus.draft);
      f.provider.failures['submitProfile'] = const ApiException(
        'x',
        statusCode: 409,
        code: 'PROFILE_INCOMPLETE',
      );
      await f.open(tester, AppRoutes.provider.path);
      f.container.read(localeProvider.notifier).select(AppLocales.tamil);
      await settle(tester);

      await tapKey(tester, 'submit_profile_button');

      expect(find.text(ta.errorProfileIncomplete), findsOneWidget);
    });

    testWidgets('changing language reloads applications in that language', (
      tester,
    ) async {
      f.provider.profile = profileOf(VerificationStatus.verified);
      await f.open(tester, AppRoutes.providerServices.path);
      expect(f.provider.listLanguages.last, 'en');
      final loadsBefore = f.provider.listLanguages.length;

      f.container.read(localeProvider.notifier).select(AppLocales.sinhala);
      await settle(tester);

      expect(f.provider.listLanguages.length, greaterThan(loadsBefore));
      expect(f.provider.listLanguages.last, 'si');
    });
  });

  // ------------------------------------------------------------- access ---

  group('access and isolation', () {
    testWidgets('every provider screen sends a signed-out user to sign in', (
      tester,
    ) async {
      f = FeatureHarness(signedIn: false);
      await f.open(tester);

      for (final location in [
        AppRoutes.provider.path,
        AppRoutes.providerProfile.path,
        AppRoutes.providerServices.path,
        AppRoutes.providerApply.path,
        AppRoutes.providerApplyLocation(categorySlug: 'plumbing'),
      ]) {
        routerOf(f.auth).go(location);
        await settle(tester);
        expect(phoneField, findsOneWidget, reason: location);
      }
      // Nothing about providers was ever requested.
      expect(f.provider.profileFetches, 0);
    });

    testWidgets(
      'the profile is fetched once, even while the user record loads',
      (tester) async {
        f.provider.profile = profileOf(VerificationStatus.verified);

        // Straight from launch: the session is restored and /auth/me is still
        // being fetched while the provider area opens.
        await f.open(tester, AppRoutes.provider.path);

        expect(f.provider.profileFetches, 1);
        expect(f.provider.listLanguages, hasLength(1));
      },
    );

    testWidgets('provider state starts over when the account changes', (
      tester,
    ) async {
      f.provider.profile = profileOf(VerificationStatus.verified);
      await f.open(tester);
      final subscription = f.container.listen(
        providerProfileProvider,
        (_, _) {},
      );
      addTearDown(subscription.close);
      await f.container.read(providerProfileProvider.future);
      final fetchesBefore = f.provider.profileFetches;

      // Someone else signs in on the same phone.
      await f.container.read(authControllerProvider.notifier).logout();
      await settle(tester);
      f.provider.profile = null;
      await f.container
          .read(authControllerProvider.notifier)
          .signIn(makeSession(f.auth.clock.now, tag: 'other'));
      await settle(tester);

      expect(f.provider.profileFetches, greaterThan(fetchesBefore));
      expect(f.container.read(providerProfileProvider).value, isNull);
    });
  });
}
