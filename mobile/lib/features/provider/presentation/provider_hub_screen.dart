import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/language_menu.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/app/theme/app_theme.dart';
import 'package:mobile/core/errors/error_message.dart';
import 'package:mobile/core/widgets/async_states.dart';
import 'package:mobile/features/provider/application/provider_providers.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';
import 'package:mobile/features/provider/presentation/status_widgets.dart';

/// The provider's home: whether they have a profile, where it is in review, and
/// a summary of their service applications.
class ProviderHubScreen extends ConsumerWidget {
  const ProviderHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final profile = ref.watch(providerProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.providerAreaTitle),
        actions: const [LanguageMenu()],
      ),
      body: SafeArea(
        child: profile.when(
          skipLoadingOnReload: true,
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(providerProfileProvider),
          ),
          data: (data) => data == null
              ? const _BecomeProvider()
              : _ProviderOverview(profile: data),
        ),
      ),
    );
  }
}

/// Shown to someone who has not created a provider profile.
class _BecomeProvider extends StatelessWidget {
  const _BecomeProvider();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    return ListView(
      padding: AppSpacing.screen,
      children: [
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.providerIntroTitle, style: textTheme.headlineSmall),
        const SizedBox(height: AppSpacing.sm),
        Text(l10n.providerIntroBody, style: textTheme.bodyLarge),
        const SizedBox(height: AppSpacing.xl),
        FilledButton(
          key: const Key('setup_profile_button'),
          onPressed: () => context.push(AppRoutes.providerProfile.path),
          child: Text(l10n.providerSetupProfile),
        ),
      ],
    );
  }
}

class _ProviderOverview extends ConsumerStatefulWidget {
  const _ProviderOverview({required this.profile});

  final ProviderProfile profile;

  @override
  ConsumerState<_ProviderOverview> createState() => _ProviderOverviewState();
}

class _ProviderOverviewState extends ConsumerState<_ProviderOverview> {
  bool _submitting = false;

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _submitting = true);
    try {
      await ref.read(providerProfileProvider.notifier).submit();
      messenger.showSnackBar(SnackBar(content: Text(l10n.providerSubmitted)));
    } on Object catch (error) {
      messenger.showSnackBar(
        SnackBar(content: Text(errorMessage(l10n, error))),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final profile = widget.profile;
    final status = profile.verificationStatus;
    final applications = ref.watch(applicationsProvider);

    return ListView(
      padding: AppSpacing.screen,
      children: [
        Card(
          child: Padding(
            padding: AppSpacing.screen,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.fullName ?? l10n.providerProfileTitle,
                  key: const Key('provider_name'),
                  style: textTheme.titleLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
                StatusChip(
                  key: const Key('verification_status'),
                  label: status.label(l10n),
                  icon: status.icon,
                  tone: toneOfVerification(status),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(status.help(l10n)),
                if (profile.reviewNote != null &&
                    status == VerificationStatus.rejected) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    l10n.providerReviewNote(profile.reviewNote!),
                    key: const Key('review_note'),
                    style: textTheme.bodyMedium,
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    OutlinedButton(
                      key: const Key('edit_profile_button'),
                      style: compactButtonStyle,
                      onPressed: () =>
                          context.push(AppRoutes.providerProfile.path),
                      child: Text(l10n.providerEditProfile),
                    ),
                    if (profile.canSubmit)
                      FilledButton(
                        key: const Key('submit_profile_button'),
                        style: compactButtonStyle,
                        onPressed: _submitting ? null : _submit,
                        child: Text(l10n.providerSubmitForReview),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _AvailabilityCard(profile: profile),
        const SizedBox(height: AppSpacing.md),
        Card(
          child: Padding(
            padding: AppSpacing.screen,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.providerMyServices, style: textTheme.titleMedium),
                const SizedBox(height: AppSpacing.sm),
                applications.when(
                  skipLoadingOnReload: true,
                  loading: () => const LinearProgressIndicator(),
                  error: (error, _) => Text(errorMessage(l10n, error)),
                  data: (items) => Text(
                    l10n.providerServicesSummary(items.length),
                    key: const Key('services_summary'),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    OutlinedButton(
                      key: const Key('manage_services_button'),
                      style: compactButtonStyle,
                      onPressed: () =>
                          context.push(AppRoutes.providerServices.path),
                      child: Text(l10n.providerManageServices),
                    ),
                    FilledButton(
                      key: const Key('add_services_button'),
                      style: compactButtonStyle,
                      onPressed: () =>
                          context.push(AppRoutes.providerApplyLocation()),
                      child: Text(l10n.providerAddServices),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// The provider's own online/offline toggle: whether automatic matching can
/// currently dispatch them a new job.
class _AvailabilityCard extends ConsumerStatefulWidget {
  const _AvailabilityCard({required this.profile});

  final ProviderProfile profile;

  @override
  ConsumerState<_AvailabilityCard> createState() => _AvailabilityCardState();
}

class _AvailabilityCardState extends ConsumerState<_AvailabilityCard> {
  bool _busy = false;

  Future<void> _toggle(bool goOnline) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await ref
          .read(providerProfileProvider.notifier)
          .setAvailability(
            goOnline
                ? ProviderAvailability.online
                : ProviderAvailability.offline,
          );
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.providerAvailabilityUpdated)),
      );
    } on Object catch (error) {
      messenger.showSnackBar(
        SnackBar(content: Text(errorMessage(l10n, error))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final isOnline = widget.profile.availability.isOnline;

    return Card(
      child: Padding(
        padding: AppSpacing.screen,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.providerAvailabilityTitle,
                    style: textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    isOnline
                        ? l10n.providerAvailabilityOnline
                        : l10n.providerAvailabilityOffline,
                    key: const Key('availability_status'),
                  ),
                  if (!isOnline) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.providerAvailabilityHelp,
                      style: textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
            Switch(
              key: const Key('availability_switch'),
              value: isOnline,
              onChanged: _busy ? null : _toggle,
            ),
          ],
        ),
      ),
    );
  }
}
