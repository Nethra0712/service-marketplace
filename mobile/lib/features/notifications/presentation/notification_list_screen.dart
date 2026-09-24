import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/language_menu.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/widgets/async_states.dart';
import 'package:mobile/features/notifications/application/notification_providers.dart';
import 'package:mobile/features/notifications/domain/notification.dart';
import 'package:mobile/features/notifications/presentation/notification_kind_icon.dart';

/// The signed-in user's notification feed: every important event this app
/// has recorded for them (see `AppNotification`'s doc comment), read or not.
class NotificationListScreen extends ConsumerWidget {
  const NotificationListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final feed = ref.watch(notificationFeedProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.notificationsTitle),
        actions: [
          if ((feed.value?.unreadCount ?? 0) > 0)
            IconButton(
              key: const Key('mark_all_read_button'),
              tooltip: l10n.notificationMarkAllRead,
              icon: const Icon(Icons.done_all),
              onPressed: () =>
                  ref.read(notificationFeedProvider.notifier).markAllRead(),
            ),
          const LanguageMenu(),
        ],
      ),
      body: SafeArea(
        child: feed.when(
          skipLoadingOnReload: true,
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(notificationFeedProvider),
          ),
          data: (data) => data.items.isEmpty
              ? EmptyView(
                  key: const Key('notifications_empty'),
                  icon: Icons.notifications_none_outlined,
                  message: l10n.notificationsEmpty,
                )
              : RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(notificationFeedProvider),
                  child: ListView.separated(
                    padding: AppSpacing.screen,
                    itemCount: data.items.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.xs),
                    itemBuilder: (context, index) =>
                        _NotificationTile(notification: data.items[index]),
                  ),
                ),
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});

  final AppNotification notification;

  void _open(BuildContext context, WidgetRef ref) {
    if (notification.isUnread) {
      unawaited(
        ref.read(notificationFeedProvider.notifier).markRead(notification.id),
      );
    }
    final bookingId = notification.bookingId;
    if (notification.kind.isBookingRelated && bookingId != null) {
      context.push(AppRoutes.bookingDetailLocation(bookingId));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = notification.isUnread;
    final scheme = Theme.of(context).colorScheme;
    return Card(
      key: Key('notification_${notification.id}'),
      margin: EdgeInsets.zero,
      color: unread ? scheme.primaryContainer.withValues(alpha: 0.35) : null,
      child: ListTile(
        leading: Icon(notification.kind.icon),
        title: Text(
          notification.title,
          style: TextStyle(
            fontWeight: unread ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        subtitle: Text(notification.body),
        trailing: unread
            ? Icon(Icons.circle, size: 10, color: scheme.primary)
            : null,
        onTap: () => _open(context, ref),
      ),
    );
  }
}
