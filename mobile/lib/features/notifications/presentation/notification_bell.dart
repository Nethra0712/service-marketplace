import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/features/notifications/application/notification_providers.dart';

/// A bell icon with an unread badge, for an [AppBar]'s actions. Opens the
/// notification list on tap.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final unread = ref.watch(unreadNotificationCountProvider);

    return IconButton(
      key: const Key('notification_bell'),
      tooltip: l10n.notificationsTitle,
      onPressed: () => context.push(AppRoutes.notifications.path),
      icon: Badge(
        label: Text('$unread'),
        isLabelVisible: unread > 0,
        child: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}
