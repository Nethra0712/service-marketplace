import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/locale_provider.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

import '../../../helpers/catalogue_fakes.dart';
import '../../../helpers/feature_harness.dart';
import '../../../helpers/pump_app.dart';

void main() {
  final en = lookupAppLocalizations(const Locale('en'));
  final si = lookupAppLocalizations(const Locale('si'));
  final ta = lookupAppLocalizations(const Locale('ta'));

  late FeatureHarness f;
  setUp(() => f = FeatureHarness());
  tearDown(() => f.dispose());

  final searchField = find.byKey(const Key('service_search_field'));
  Finder tile(String slug) => find.byKey(Key('category_$slug'));

  Future<void> search(WidgetTester tester, String text) async {
    await tester.enterText(searchField, text);
    await settle(tester); // longer than the debounce
  }

  group('service list', () {
    testWidgets('shows the active categories with description and pricing', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.services.path);

      expect(tile('plumbing'), findsOneWidget);
      expect(tile('cleaning'), findsOneWidget);
      expect(tile('ac-repair'), findsOneWidget);
      expect(find.text('Leaks, drains and taps.'), findsOneWidget);
      expect(find.text(en.pricingHourly), findsWidgets);
      expect(f.catalogue.listCalls.first.language, 'en');
    });

    testWidgets('inactive categories are not shown', (tester) async {
      f.catalogue.hidden.add('cleaning');

      await f.open(tester, AppRoutes.services.path);

      expect(tile('cleaning'), findsNothing);
      expect(tile('plumbing'), findsOneWidget);
    });

    testWidgets('searching filters the list, after a short pause', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.services.path);
      final callsBefore = f.catalogue.listCalls.length;

      await tester.enterText(searchField, 'clean');
      await tester.pump(const Duration(milliseconds: 100));
      // Still typing: no request per keystroke.
      expect(f.catalogue.listCalls.length, callsBefore);

      await settle(tester);

      expect(tile('cleaning'), findsOneWidget);
      expect(tile('plumbing'), findsNothing);
      expect(f.catalogue.listCalls.last.search, 'clean');
    });

    testWidgets('a search with no results says so and can be cleared', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.services.path);

      await search(tester, 'zzz');

      expect(find.text(en.servicesNoMatch), findsOneWidget);
      expect(tile('plumbing'), findsNothing);

      await tester.tap(find.text(en.servicesClearFilters));
      await settle(tester);

      expect(tile('plumbing'), findsOneWidget);
      expect(tester.widget<TextField>(searchField).controller!.text, isEmpty);
    });

    testWidgets('filters by pricing model, and tapping again clears it', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.services.path);

      await tester.tap(find.byKey(const Key('pricing_filter_hourly')));
      await settle(tester);

      expect(tile('cleaning'), findsOneWidget);
      expect(tile('plumbing'), findsNothing);
      expect(tile('ac-repair'), findsNothing);
      expect(f.catalogue.listCalls.last.model, PricingModel.hourly);

      await tester.tap(find.byKey(const Key('pricing_filter_hourly')));
      await settle(tester);

      expect(f.catalogue.listCalls.last.model, isNull);
      expect(tile('plumbing'), findsOneWidget);
    });

    testWidgets('search and pricing filter combine', (tester) async {
      await f.open(tester, AppRoutes.services.path);

      await tester.tap(find.byKey(const Key('pricing_filter_fixed')));
      await search(tester, 'repair');

      expect(tile('ac-repair'), findsOneWidget);
      expect(tile('cleaning'), findsNothing);
      expect(f.catalogue.listCalls.last.search, 'repair');
      expect(f.catalogue.listCalls.last.model, PricingModel.fixed);
    });

    testWidgets('an empty catalogue shows a plain message, no "clear"', (
      tester,
    ) async {
      f.catalogue.categories.clear();

      await f.open(tester, AppRoutes.services.path);

      expect(find.text(en.servicesEmpty), findsOneWidget);
      expect(find.text(en.servicesClearFilters), findsNothing);
    });

    testWidgets('a failure shows a localized error, and retry recovers', (
      tester,
    ) async {
      f.catalogue.failWith = const NetworkException('offline');

      await f.open(tester, AppRoutes.services.path);

      expect(find.text(en.errorNetwork), findsOneWidget);
      expect(tile('plumbing'), findsNothing);

      f.catalogue.failWith = null;
      await tester.tap(find.byKey(const Key('retry_button')));
      await settle(tester);

      expect(tile('plumbing'), findsOneWidget);
      expect(find.byKey(const Key('error_message')), findsNothing);
    });

    testWidgets('has no booking action', (tester) async {
      await f.open(tester, AppRoutes.services.path);

      expect(find.textContaining('Book'), findsNothing);
    });
  });

  group('service details', () {
    testWidgets('shows the description, pricing, cities and provider count', (
      tester,
    ) async {
      f = FeatureHarness(
        catalogue: FakeCatalogueRepository(
          cities: const [colombo, kandy],
          availableProviders: {'plumbing': 3},
        ),
      );

      await f.open(tester, AppRoutes.serviceDetailLocation('plumbing'));

      expect(find.byKey(const Key('service_name')), findsOneWidget);
      expect(find.text('Leaks, drains and taps.'), findsOneWidget);
      expect(find.text(en.pricingQuote), findsOneWidget);
      expect(find.text(en.pricingQuoteHelp), findsOneWidget);
      expect(find.byKey(const Key('city_colombo')), findsOneWidget);
      expect(find.byKey(const Key('city_kandy')), findsOneWidget);
      expect(find.text('3 approved providers'), findsOneWidget);
    });

    testWidgets('says so plainly when no provider is approved yet', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.serviceDetailLocation('plumbing'));

      expect(find.text('No approved providers yet'), findsOneWidget);
    });

    testWidgets('uses the singular for exactly one provider', (tester) async {
      f = FeatureHarness(
        catalogue: FakeCatalogueRepository(availableProviders: {'plumbing': 1}),
      );

      await f.open(tester, AppRoutes.serviceDetailLocation('plumbing'));

      expect(find.text('1 approved provider'), findsOneWidget);
    });

    testWidgets('opens from the list', (tester) async {
      await f.open(tester, AppRoutes.services.path);

      await tester.tap(tile('cleaning'));
      await settle(tester);

      expect(find.byKey(const Key('service_name')), findsOneWidget);
      expect(find.text(en.pricingHourly), findsOneWidget);
      expect(f.catalogue.detailCalls.single.slug, 'cleaning');
    });

    testWidgets('an inactive or unknown service is "not available"', (
      tester,
    ) async {
      f.catalogue.hidden.add('cleaning');

      await f.open(tester, AppRoutes.serviceDetailLocation('cleaning'));

      expect(find.byKey(const Key('service_not_available')), findsOneWidget);
      expect(find.text(en.serviceDetailNotAvailable), findsOneWidget);
      // A retry could never help, so none is offered.
      expect(find.byKey(const Key('retry_button')), findsNothing);
    });

    testWidgets(
      'a missing service is asked for once, not retried in the background',
      (tester) async {
        f.catalogue.hidden.add('cleaning');

        await f.open(tester, AppRoutes.serviceDetailLocation('cleaning'));
        await tester.pump(const Duration(seconds: 5));

        expect(f.catalogue.detailCalls, hasLength(1));
      },
    );

    testWidgets('a network failure offers a retry', (tester) async {
      f.catalogue.failWith = const NetworkException('offline');

      await f.open(tester, AppRoutes.serviceDetailLocation('plumbing'));

      expect(find.text(en.errorNetwork), findsOneWidget);
      expect(find.byKey(const Key('retry_button')), findsOneWidget);
    });

    testWidgets('has no booking action', (tester) async {
      await f.open(tester, AppRoutes.serviceDetailLocation('plumbing'));

      expect(find.textContaining('Book'), findsNothing);
    });
  });

  group('localization', () {
    testWidgets(
      'the list follows the chosen language, and asks the server in it',
      (tester) async {
        await f.open(tester, AppRoutes.services.path);

        f.container.read(localeProvider.notifier).select(AppLocales.sinhala);
        await settle(tester);

        expect(find.text(si.servicesSearchHint), findsOneWidget);
        expect(find.text(si.servicesFilterAll), findsOneWidget);
        // Category names come back from the server already translated.
        expect(find.text('ජලනල කටයුතු'), findsOneWidget);
        expect(find.text('Plumbing'), findsNothing);
        expect(f.catalogue.listCalls.last.language, 'si');
      },
    );

    testWidgets('Tamil too', (tester) async {
      await f.open(tester, AppRoutes.services.path);

      f.container.read(localeProvider.notifier).select(AppLocales.tamil);
      await settle(tester);

      expect(find.text(ta.servicesSearchHint), findsOneWidget);
      expect(find.text('குழாய் வேலை'), findsOneWidget);
      expect(f.catalogue.listCalls.last.language, 'ta');
    });

    testWidgets('the detail page follows the language, including the count', (
      tester,
    ) async {
      f = FeatureHarness(
        catalogue: FakeCatalogueRepository(availableProviders: {'plumbing': 2}),
      );
      await f.open(tester, AppRoutes.serviceDetailLocation('plumbing'));

      f.container.read(localeProvider.notifier).select(AppLocales.sinhala);
      await settle(tester);

      expect(find.text(si.pricingQuote), findsOneWidget);
      expect(find.text(si.serviceDetailProviders(2)), findsOneWidget);
      expect(f.catalogue.detailCalls.last.language, 'si');
    });

    testWidgets('a language the backend does not have falls back to English', (
      tester,
    ) async {
      await f.open(tester, AppRoutes.services.path);

      f.container.read(localeProvider.notifier).select(const Locale('fr'));
      await settle(tester);

      // Never asks the server for a language it cannot answer in.
      expect(f.catalogue.listCalls.last.language, 'en');
    });
  });

  group('access', () {
    testWidgets('a signed-out deep link to a service goes to sign in', (
      tester,
    ) async {
      f = FeatureHarness(signedIn: false);
      await f.open(tester);

      routerOf(f.auth).go(AppRoutes.serviceDetailLocation('plumbing'));
      await settle(tester);

      expect(phoneField, findsOneWidget);
      expect(find.byKey(const Key('service_name')), findsNothing);
      // Nothing was fetched on behalf of a signed-out user.
      expect(f.catalogue.detailCalls, isEmpty);
    });
  });
}
