import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/features/notifications/application/notification_providers.dart';

/// An explainer shown before ever asking the OS for notification permission
/// — a bare system prompt with no context leads to more declines and cannot
/// be shown again if refused, so the app earns the right to ask first. Only
/// appears while signed in, push is not already enabled, and it has not
/// already been dismissed this session (see
/// `notificationPermissionDismissedProvider`).
class NotificationPermissionBanner extends ConsumerWidget {
  const NotificationPermissionBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dismissed = ref.watch(notificationPermissionDismissedProvider);
    final tokenState = ref.watch(deviceTokenControllerProvider);
    final alreadyEnabled = tokenState.value != null;
    if (dismissed || alreadyEnabled) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Card(
      key: const Key('notification_permission_banner'),
      child: Padding(
        padding: AppSpacing.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.notifications_active_outlined),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    l10n.notificationPermissionTitle,
                    style: textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(l10n.notificationPermissionBody),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                FilledButton(
                  key: const Key('notification_permission_allow_button'),
                  onPressed: () => ref
                      .read(deviceTokenControllerProvider.notifier)
                      .requestPermissionAndRegister(),
                  child: Text(l10n.notificationPermissionAllow),
                ),
                TextButton(
                  key: const Key('notification_permission_dismiss_button'),
                  onPressed: () => ref
                      .read(notificationPermissionDismissedProvider.notifier)
                      .dismiss(),
                  child: Text(l10n.notificationPermissionNotNow),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
