import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/language_menu.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/widgets/async_states.dart';
import 'package:mobile/features/services/application/catalogue_providers.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';
import 'package:mobile/features/services/domain/service_category.dart';
import 'package:mobile/features/services/presentation/pricing_model_labels.dart';

/// How long typing must pause before the list is searched again.
const searchDebounce = Duration(milliseconds: 350);

/// The service catalogue: search, filter by pricing model, open a service.
class ServicesScreen extends ConsumerStatefulWidget {
  const ServicesScreen({super.key});

  @override
  ConsumerState<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(
      searchDebounce,
      () => ref.read(catalogueFilterProvider.notifier).setSearch(value),
    );
  }

  void _clearFilters() {
    _debounce?.cancel();
    _searchController.clear();
    ref.read(catalogueFilterProvider.notifier).clear();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final filter = ref.watch(catalogueFilterProvider);
    final categories = ref.watch(categoryListProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.servicesTitle),
        actions: const [LanguageMenu()],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: TextField(
                key: const Key('service_search_field'),
                controller: _searchController,
                onChanged: _onSearchChanged,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: l10n.servicesSearchHint,
                  prefixIcon: const Icon(Icons.search),
                  border: const OutlineInputBorder(),
                ),
              ),
            ),
            _PricingFilterBar(
              selected: filter.pricingModel,
              onSelected: ref
                  .read(catalogueFilterProvider.notifier)
                  .setPricingModel,
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              // Keep the previous list on screen while a new search loads
              // instead of flashing a spinner on every keystroke.
              child: categories.when(
                skipLoadingOnReload: true,
                loading: () => const LoadingView(),
                error: (error, _) => ErrorView(
                  error: error,
                  onRetry: () => ref.invalidate(categoryListProvider),
                ),
                data: (items) => items.isEmpty
                    ? EmptyView(
                        key: const Key('services_empty'),
                        icon: Icons.search_off,
                        message: filter.isActive
                            ? l10n.servicesNoMatch
                            : l10n.servicesEmpty,
                        actionLabel: filter.isActive
                            ? l10n.servicesClearFilters
                            : null,
                        onAction: _clearFilters,
                      )
                    : RefreshIndicator(
                        onRefresh: () =>
                            ref.refresh(categoryListProvider.future),
                        child: _CategoryList(items: items),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PricingFilterBar extends StatelessWidget {
  const _PricingFilterBar({required this.selected, required this.onSelected});

  final PricingModel? selected;
  final ValueChanged<PricingModel?> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Row(
        children: [
          ChoiceChip(
            key: const Key('pricing_filter_all'),
            label: Text(l10n.servicesFilterAll),
            selected: selected == null,
            onSelected: (_) => onSelected(null),
          ),
          for (final model in PricingModel.values) ...[
            const SizedBox(width: AppSpacing.sm),
            ChoiceChip(
              key: Key('pricing_filter_${model.name}'),
              label: Text(model.label(l10n)),
              selected: selected == model,
              // Tapping the selected chip again clears it.
              onSelected: (on) => onSelected(on ? model : null),
            ),
          ],
        ],
      ),
    );
  }
}

class _CategoryList extends StatelessWidget {
  const _CategoryList({required this.items});

  final List<ServiceCategory> items;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListView.separated(
      // Pull-to-refresh needs a scrollable even when the list is short.
      physics: const AlwaysScrollableScrollPhysics(),
      padding: AppSpacing.screen,
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (context, index) {
        final category = items[index];
        return Card(
          margin: EdgeInsets.zero,
          child: ListTile(
            key: Key('category_${category.slug}'),
            title: Text(category.name),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (category.description != null)
                  Text(
                    category.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  category.pricingModel.label(l10n),
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ],
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () =>
                context.push(AppRoutes.serviceDetailLocation(category.slug)),
          ),
        );
      },
    );
  }
}
