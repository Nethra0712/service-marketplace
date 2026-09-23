import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/language_menu.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/widgets/async_states.dart';
import 'package:mobile/features/services/application/catalogue_providers.dart';
import 'package:mobile/features/services/domain/service_category.dart';
import 'package:mobile/features/services/presentation/pricing_model_labels.dart';

/// One service: what it is, how it is priced, where it is offered, and the
/// entry points to request it as a customer or offer it as a provider.
class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({required this.slug, super.key});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(categoryDetailProvider(slug));

    return Scaffold(
      appBar: AppBar(
        title: Text(detail.value?.category.name ?? l10n.servicesTitle),
        actions: const [LanguageMenu()],
      ),
      body: SafeArea(
        child: detail.when(
          skipLoadingOnReload: true,
          loading: () => const LoadingView(),
          // A service that is inactive or unknown is a 404: say so plainly
          // rather than offering a retry that can never succeed.
          error: (error, _) => error is NotFoundException
              ? EmptyView(
                  key: const Key('service_not_available'),
                  icon: Icons.block,
                  message: l10n.serviceDetailNotAvailable,
                )
              : ErrorView(
                  error: error,
                  onRetry: () => ref.invalidate(categoryDetailProvider(slug)),
                ),
          data: (data) => _Detail(detail: data),
        ),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.detail});

  final ServiceCategoryDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final category = detail.category;

    return ListView(
      padding: AppSpacing.screen,
      children: [
        Text(
          category.name,
          key: const Key('service_name'),
          style: textTheme.headlineSmall,
        ),
        if (category.description != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(category.description!, style: textTheme.bodyLarge),
        ],
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.serviceDetailPricing, style: textTheme.titleMedium),
        const SizedBox(height: AppSpacing.xs),
        Text(
          category.pricingModel.label(l10n),
          key: const Key('service_pricing'),
          style: textTheme.bodyLarge,
        ),
        Text(category.pricingModel.help(l10n), style: textTheme.bodyMedium),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.serviceDetailAvailableIn, style: textTheme.titleMedium),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.sm,
          children: [
            for (final city in detail.cities)
              Chip(key: Key('city_${city.slug}'), label: Text(city.name)),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            const Icon(Icons.verified_user_outlined),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                l10n.serviceDetailProviders(detail.availableProviderCount),
                key: const Key('service_providers'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xl),
        FilledButton(
          key: const Key('request_service_button'),
          onPressed: () =>
              context.push(AppRoutes.serviceRequestLocation(category.slug)),
          child: Text(l10n.serviceDetailRequest),
        ),
        const SizedBox(height: AppSpacing.md),
        OutlinedButton(
          key: const Key('offer_service_button'),
          onPressed: () => context.push(
            AppRoutes.providerApplyLocation(categorySlug: category.slug),
          ),
          child: Text(l10n.serviceDetailOffer),
        ),
      ],
    );
  }
}
