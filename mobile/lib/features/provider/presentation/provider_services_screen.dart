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
import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/provider/presentation/status_widgets.dart';
import 'package:mobile/features/services/presentation/pricing_model_labels.dart';

/// The provider's service applications and where each one stands.
class ProviderServicesScreen extends ConsumerWidget {
  const ProviderServicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final applications = ref.watch(applicationsProvider);
    final profile = ref.watch(providerProfileProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.providerMyServices),
        actions: const [LanguageMenu()],
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('add_services_fab'),
        onPressed: () => context.push(AppRoutes.providerApplyLocation()),
        icon: const Icon(Icons.add),
        label: Text(l10n.providerAddServices),
      ),
      body: SafeArea(
        child: applications.when(
          skipLoadingOnReload: true,
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(applicationsProvider),
          ),
          data: (items) => items.isEmpty
              ? EmptyView(
                  key: const Key('applications_empty'),
                  icon: Icons.handyman_outlined,
                  message: l10n.providerServicesSummary(0),
                  actionLabel: l10n.providerAddServices,
                  onAction: () =>
                      context.push(AppRoutes.providerApplyLocation()),
                )
              : RefreshIndicator(
                  onRefresh: () => ref.refresh(applicationsProvider.future),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    // Room for the floating button so it never covers a card.
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                      88,
                    ),
                    children: [
                      // Approval for a service is not enough on its own: the
                      // provider's profile must be verified too.
                      if (profile != null && !profile.isVerified)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.md),
                          child: Card(
                            color: Theme.of(context)
                                .colorScheme
                                .surfaceContainer,
                            child: ListTile(
                              key: const Key('verify_first_banner'),
                              leading: const Icon(Icons.info_outline),
                              title: Text(l10n.providerVerifyFirst),
                            ),
                          ),
                        ),
                      for (final application in items) ...[
                        _ApplicationCard(application: application),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                    ],
                  ),
                ),
        ),
      ),
    );
  }
}

class _ApplicationCard extends ConsumerStatefulWidget {
  const _ApplicationCard({required this.application});

  final ProviderApplication application;

  @override
  ConsumerState<_ApplicationCard> createState() => _ApplicationCardState();
}

class _ApplicationCardState extends ConsumerState<_ApplicationCard> {
  bool _busy = false;

  Future<void> _run(
    Future<void> Function() action,
    String successMessage,
  ) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(successMessage)));
    } on Object catch (error) {
      messenger.showSnackBar(
        SnackBar(content: Text(errorMessage(l10n, error))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmWithdraw() async {
    final l10n = AppLocalizations.of(context);
    final application = widget.application;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.providerWithdrawTitle),
        content: Text(l10n.providerWithdrawBody(application.categoryName)),
        actions: [
          TextButton(
            key: const Key('withdraw_cancel'),
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          TextButton(
            key: const Key('withdraw_confirm'),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.providerWithdraw),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _run(
      () => ref.read(applicationsProvider.notifier).withdraw(application.id),
      l10n.providerWithdrawn,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final application = widget.application;
    final status = application.status;

    return Card(
      key: Key('application_${application.categorySlug}'),
      margin: EdgeInsets.zero,
      child: Padding(
        padding: AppSpacing.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(application.categoryName, style: textTheme.titleMedium),
            Text(
              '${application.cityName} · ${application.pricingModel.label(l10n)}',
              style: textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            StatusChip(
              key: Key('application_status_${application.categorySlug}'),
              label: status.label(l10n),
              icon: status.icon,
              tone: toneOfApplication(status),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(status.help(l10n)),
            if (application.reviewNote != null &&
                (status == ApplicationStatus.rejected ||
                    status == ApplicationStatus.suspended)) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                l10n.providerReviewNote(application.reviewNote!),
                style: textTheme.bodyMedium,
              ),
            ],
            if (application.canResubmit || application.canWithdraw) ...[
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  if (application.canResubmit)
                    FilledButton.tonal(
                      key: Key('resubmit_${application.categorySlug}'),
                      style: compactButtonStyle,
                      onPressed: _busy
                          ? null
                          : () => _run(
                              () => ref
                                  .read(applicationsProvider.notifier)
                                  .resubmit(application.id),
                              l10n.providerResubmitted,
                            ),
                      child: Text(l10n.providerResubmit),
                    ),
                  if (application.canWithdraw)
                    TextButton(
                      key: Key('withdraw_${application.categorySlug}'),
                      onPressed: _busy ? null : _confirmWithdraw,
                      child: Text(l10n.providerWithdraw),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
