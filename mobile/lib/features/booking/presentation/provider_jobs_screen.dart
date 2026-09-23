import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/language_menu.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/widgets/async_states.dart';
import 'package:mobile/features/booking/application/booking_providers.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/presentation/booking_status_labels.dart';
import 'package:mobile/features/services/presentation/pricing_model_labels.dart';

/// A provider's jobs: open requests they could accept or quote on, and the
/// jobs already assigned to them.
class ProviderJobsScreen extends ConsumerStatefulWidget {
  const ProviderJobsScreen({super.key});

  @override
  ConsumerState<ProviderJobsScreen> createState() => _ProviderJobsScreenState();
}

class _ProviderJobsScreenState extends ConsumerState<ProviderJobsScreen>
    with SingleTickerProviderStateMixin {
  late final _tabs = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final open = ref.watch(openBookingsProvider);
    final assigned = ref.watch(assignedBookingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.providerJobsTitle),
        actions: const [LanguageMenu()],
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(text: l10n.providerJobsOpen),
            Tab(text: l10n.providerJobsAssigned),
          ],
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabs,
          children: [
            _JobList(
              bookings: open,
              onRetry: () => ref.invalidate(openBookingsProvider),
              emptyIcon: Icons.search_off,
              emptyMessage: l10n.providerJobsOpenEmpty,
              showCustomer: false,
            ),
            _JobList(
              bookings: assigned,
              onRetry: () => ref.invalidate(assignedBookingsProvider),
              emptyIcon: Icons.work_outline,
              emptyMessage: l10n.providerJobsAssignedEmpty,
              showCustomer: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _JobList extends StatelessWidget {
  const _JobList({
    required this.bookings,
    required this.onRetry,
    required this.emptyIcon,
    required this.emptyMessage,
    required this.showCustomer,
  });

  final AsyncValue<List<Booking>> bookings;
  final VoidCallback onRetry;
  final IconData emptyIcon;
  final String emptyMessage;
  final bool showCustomer;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return bookings.when(
      skipLoadingOnReload: true,
      loading: () => const LoadingView(),
      error: (error, _) => ErrorView(error: error, onRetry: onRetry),
      data: (items) => items.isEmpty
          ? EmptyView(
              key: const Key('jobs_empty'),
              icon: emptyIcon,
              message: emptyMessage,
            )
          : ListView.separated(
              padding: AppSpacing.screen,
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) {
                final booking = items[index];
                final offer = booking.myOffer;
                final subtitle = showCustomer
                    ? '${booking.customer.fullName ?? l10n.bookingNameUnknown} · ${booking.status.label(l10n)}'
                    : offer == null
                    ? '${booking.cityName} · ${booking.pricingModel.label(l10n)}'
                    : '${booking.cityName} · ${booking.pricingModel.label(l10n)} · ${l10n.bookingOfferRespondBy(MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(offer.respondsBy)))}';
                return Card(
                  margin: EdgeInsets.zero,
                  child: ListTile(
                    key: Key('job_${booking.id}'),
                    title: Text(booking.categoryName),
                    subtitle: Text(subtitle),
                    onTap: () => context.push(
                      AppRoutes.bookingDetailLocation(booking.id),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
