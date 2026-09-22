import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/errors/error_message.dart';
import 'package:mobile/core/widgets/async_states.dart';
import 'package:mobile/features/provider/application/provider_providers.dart';
import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/services/application/catalogue_providers.dart';
import 'package:mobile/features/services/domain/service_category.dart';
import 'package:mobile/features/services/presentation/pricing_model_labels.dart';

/// Choose services to apply for. Eligibility is per service *and* city, so a
/// city is picked first (implicit while there is only one).
class ProviderApplyScreen extends ConsumerStatefulWidget {
  const ProviderApplyScreen({this.initialCategorySlug, super.key});

  /// A service to have ticked already, e.g. when arriving from its detail page.
  final String? initialCategorySlug;

  @override
  ConsumerState<ProviderApplyScreen> createState() =>
      _ProviderApplyScreenState();
}

class _ProviderApplyScreenState extends ConsumerState<ProviderApplyScreen> {
  late final Set<String> _selected = {
    if (widget.initialCategorySlug != null) widget.initialCategorySlug!,
  };
  String? _citySlug;
  bool _applying = false;

  /// Failures from the last attempt, kept so the person can see which service
  /// failed and why while the ones that worked are already gone from the list.
  Map<String, AppException> _failed = const {};

  Future<void> _apply(String citySlug, List<ServiceCategory> available) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    // Only what is still on screen: never apply for a service that was hidden.
    final slugs = [
      for (final c in available)
        if (_selected.contains(c.slug)) c.slug,
    ];
    if (slugs.isEmpty) return;

    setState(() {
      _applying = true;
      _failed = const {};
    });
    final outcome = await ref
        .read(applicationsProvider.notifier)
        .applyMany(citySlug: citySlug, categorySlugs: slugs);
    if (!mounted) return;

    setState(() {
      _applying = false;
      _failed = outcome.failed;
      _selected
        ..clear()
        ..addAll(outcome.failed.keys);
    });
    if (outcome.applied.isNotEmpty) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.providerApplySent(outcome.applied.length))),
      );
    }
    if (!outcome.hasFailures) {
      // Everything went through: show them with their status.
      unawaited(router.pushReplacement(AppRoutes.providerServices.path));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final profile = ref.watch(providerProfileProvider);
    final cities = ref.watch(citiesProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.providerApplyTitle)),
      body: SafeArea(
        child: profile.when(
          skipLoadingOnReload: true,
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(providerProfileProvider),
          ),
          data: (data) => data == null
              ? EmptyView(
                  key: const Key('apply_needs_profile'),
                  icon: Icons.person_add_alt,
                  message: l10n.providerApplyNeedProfile,
                  actionLabel: l10n.providerSetupProfile,
                  onAction: () => context.push(AppRoutes.providerProfile.path),
                )
              : cities.when(
                  loading: () => const LoadingView(),
                  error: (error, _) => ErrorView(
                    error: error,
                    onRetry: () => ref.invalidate(citiesProvider),
                  ),
                  data: _buildChooser,
                ),
        ),
      ),
    );
  }

  Widget _buildChooser(List<City> cities) {
    final l10n = AppLocalizations.of(context);
    if (cities.isEmpty) return EmptyView(message: l10n.servicesEmpty);

    final city = cities.firstWhere(
      (c) => c.slug == _citySlug,
      orElse: () => cities.first,
    );
    final categories = ref.watch(categoriesInCityProvider(city.slug));
    final applications = ref.watch(applicationsProvider);

    return categories.when(
      loading: () => const LoadingView(),
      error: (error, _) => ErrorView(
        error: error,
        onRetry: () => ref.invalidate(categoriesInCityProvider(city.slug)),
      ),
      data: (all) => applications.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(applicationsProvider),
        ),
        data: (existing) {
          final applied = {
            for (final ProviderApplication a in existing)
              if (a.citySlug == city.slug) a.categorySlug,
          };
          final available = [
            for (final c in all)
              if (!applied.contains(c.slug)) c,
          ];
          return _buildList(cities, city, available);
        },
      ),
    );
  }

  Widget _buildList(
    List<City> cities,
    City city,
    List<ServiceCategory> available,
  ) {
    final l10n = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final chosen = [
      for (final c in available)
        if (_selected.contains(c.slug)) c,
    ];

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: AppSpacing.screen,
            children: [
              Text(l10n.providerApplyIntro),
              if (cities.length > 1) ...[
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<String>(
                  key: const Key('city_dropdown'),
                  initialValue: city.slug,
                  decoration: InputDecoration(
                    labelText: l10n.providerApplyCity,
                    border: const OutlineInputBorder(),
                  ),
                  items: [
                    for (final c in cities)
                      DropdownMenuItem(value: c.slug, child: Text(c.name)),
                  ],
                  onChanged: (slug) => setState(() {
                    _citySlug = slug;
                    _selected.clear();
                    _failed = const {};
                  }),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              if (available.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                  child: Text(
                    l10n.providerApplyNothingLeft,
                    key: const Key('apply_nothing_left'),
                    textAlign: TextAlign.center,
                  ),
                ),
              for (final category in available)
                CheckboxListTile(
                  key: Key('apply_category_${category.slug}'),
                  value: _selected.contains(category.slug),
                  onChanged: _applying
                      ? null
                      : (on) => setState(() {
                          if (on ?? false) {
                            _selected.add(category.slug);
                          } else {
                            _selected.remove(category.slug);
                          }
                          _failed = Map.of(_failed)..remove(category.slug);
                        }),
                  title: Text(category.name),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(category.pricingModel.label(l10n)),
                      if (_failed[category.slug] case final error?)
                        Text(
                          errorMessage(l10n, error),
                          key: Key('apply_error_${category.slug}'),
                          style: TextStyle(color: colors.error),
                        ),
                    ],
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
            ],
          ),
        ),
        Padding(
          padding: AppSpacing.screen,
          child: SizedBox(
            width: double.infinity,
            child: FilledButton(
              key: const Key('apply_button'),
              onPressed: chosen.isEmpty || _applying
                  ? null
                  : () => _apply(city.slug, available),
              child: _applying
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(l10n.providerApplyButton(chosen.length)),
            ),
          ),
        ),
      ],
    );
  }
}
