import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/language_menu.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/domain/phone_number.dart';
import 'package:mobile/features/notifications/presentation/notification_bell.dart';
import 'package:mobile/features/notifications/presentation/notification_permission_banner.dart';

/// Placeholder home screen. Demonstrates localization, navigation and sign-out.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appTitle),
        actions: const [NotificationBell(), LanguageMenu()],
      ),
      body: SafeArea(
        child: ListView(
          padding: AppSpacing.screen,
          children: [
            const SizedBox(height: AppSpacing.lg),
            const NotificationPermissionBanner(),
            Text(l10n.homeWelcome, style: textTheme.headlineMedium),
            const SizedBox(height: AppSpacing.sm),
            Text(l10n.homeSubtitle, style: textTheme.bodyLarge),
            if (user != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.homeSignedInAs(formatPhoneForDisplay(user.phone)),
                key: const Key('signed_in_as'),
                style: textTheme.bodyMedium,
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            FilledButton(
              onPressed: () => context.push(AppRoutes.services.path),
              child: Text(l10n.servicesTitle),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              key: const Key('my_bookings_button'),
              onPressed: () => context.push(AppRoutes.bookings.path),
              child: Text(l10n.bookingHistoryTitle),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              key: const Key('provider_area_button'),
              onPressed: () => context.push(AppRoutes.provider.path),
              child: Text(l10n.homeProviderArea),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              key: const Key('provider_jobs_button'),
              onPressed: () => context.push(AppRoutes.providerJobs.path),
              child: Text(l10n.providerJobsTitle),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              onPressed: () => context.push(AppRoutes.profile.path),
              child: Text(l10n.profileTitle),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              key: const Key('sign_out_button'),
              onPressed: () =>
                  ref.read(authControllerProvider.notifier).logout(),
              child: Text(l10n.authSignOut),
            ),
          ],
        ),
      ),
    );
  }
}
