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

/// The signed-in customer's bookings, split into what's still going on and
/// what's finished (completed or cancelled).
class BookingHistoryScreen extends ConsumerStatefulWidget {
  const BookingHistoryScreen({super.key});

  @override
  ConsumerState<BookingHistoryScreen> createState() =>
      _BookingHistoryScreenState();
}

class _BookingHistoryScreenState extends ConsumerState<BookingHistoryScreen>
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
    final bookings = ref.watch(myBookingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.bookingHistoryTitle),
        actions: const [LanguageMenu()],
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(text: l10n.bookingHistoryActive),
            Tab(text: l10n.bookingHistoryPast),
          ],
        ),
      ),
      body: SafeArea(
        child: bookings.when(
          skipLoadingOnReload: true,
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(myBookingsProvider),
          ),
          data: (items) => TabBarView(
            controller: _tabs,
            children: [
              _BookingTab(
                bookings: items
                    .where(BookingHistoryTab.active.matches)
                    .toList(growable: false),
                emptyMessage: l10n.bookingHistoryActiveEmpty,
              ),
              _BookingTab(
                bookings: items
                    .where(BookingHistoryTab.past.matches)
                    .toList(growable: false),
                emptyMessage: l10n.bookingHistoryPastEmpty,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BookingTab extends StatelessWidget {
  const _BookingTab({required this.bookings, required this.emptyMessage});

  final List<Booking> bookings;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    if (bookings.isEmpty) {
      return EmptyView(
        key: const Key('bookings_empty'),
        icon: Icons.event_busy_outlined,
        message: emptyMessage,
      );
    }
    return ListView.separated(
      padding: AppSpacing.screen,
      itemCount: bookings.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (context, index) => _BookingTile(booking: bookings[index]),
    );
  }
}

class _BookingTile extends StatelessWidget {
  const _BookingTile({required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        key: Key('booking_${booking.id}'),
        title: Text(booking.categoryName),
        subtitle: Text(
          '${booking.cityName} · ${booking.pricingModel.label(l10n)}',
        ),
        trailing: Chip(
          avatar: Icon(booking.status.icon, size: 16),
          label: Text(booking.status.label(l10n)),
          visualDensity: VisualDensity.compact,
        ),
        onTap: () => context.push(AppRoutes.bookingDetailLocation(booking.id)),
      ),
    );
  }
}
