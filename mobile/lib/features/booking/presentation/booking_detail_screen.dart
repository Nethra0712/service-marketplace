import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/language_menu.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/errors/error_message.dart';
import 'package:mobile/core/widgets/async_states.dart';
import 'package:mobile/core/widgets/status_chip.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/booking/application/booking_providers.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/booking/domain/quote.dart';
import 'package:mobile/features/booking/presentation/booking_status_labels.dart';
import 'package:mobile/features/provider/application/provider_providers.dart';
import 'package:mobile/features/services/presentation/pricing_model_labels.dart';

/// One booking: what it is, its status, and every action either side can
/// take from here. Adapts to whoever is looking: the customer, the assigned
/// provider, or an eligible provider still deciding whether to accept/quote.
class BookingDetailScreen extends ConsumerWidget {
  const BookingDetailScreen({required this.bookingId, super.key});

  final String bookingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final booking = ref.watch(bookingDetailProvider(bookingId));

    return Scaffold(
      appBar: AppBar(
        title: Text(booking.value?.categoryName ?? l10n.bookingDetailTitle),
        actions: const [LanguageMenu()],
      ),
      body: SafeArea(
        child: booking.when(
          skipLoadingOnReload: true,
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(bookingDetailProvider(bookingId)),
          ),
          data: (data) => _BookingBody(booking: data),
        ),
      ),
    );
  }
}

class _BookingBody extends ConsumerWidget {
  const _BookingBody({required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final myUserId = ref.watch(currentUserProvider)?.id;
    final myProviderProfileId = ref.watch(providerProfileProvider).value?.id;

    final isCustomer = booking.customer.id == myUserId;
    final isAssignedProvider =
        myProviderProfileId != null &&
        booking.provider?.id == myProviderProfileId;
    final isCandidateProvider =
        !isCustomer &&
        !isAssignedProvider &&
        booking.status == BookingStatus.searching &&
        myProviderProfileId != null;

    return ListView(
      padding: AppSpacing.screen,
      children: [
        StatusChip(
          key: const Key('booking_status'),
          label: booking.status.label(l10n),
          icon: booking.status.icon,
          tone: booking.status.tone,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(booking.status.help(l10n)),
        if (booking.cancellation case final cancellation?) ...[
          const SizedBox(height: AppSpacing.sm),
          if (cancellation.reason != null)
            Text(
              l10n.bookingCancelReason(cancellation.reason!),
              key: const Key('cancellation_reason'),
            ),
        ],
        const SizedBox(height: AppSpacing.lg),
        _InfoRow(label: l10n.bookingCategoryLabel, value: booking.categoryName),
        _InfoRow(label: l10n.bookingCityLabel, value: booking.cityName),
        _InfoRow(
          label: l10n.bookingPricingLabel,
          value: booking.pricingModel.label(l10n),
        ),
        if (booking.agreedAmount != null)
          _InfoRow(
            key: const Key('agreed_amount'),
            label: l10n.bookingAgreedAmountLabel,
            value: l10n.bookingAmountLkr(booking.agreedAmount!),
          ),
        if (booking.scheduledAt != null)
          _InfoRow(
            label: l10n.bookingScheduledLabel,
            value: MaterialLocalizations.of(context)
                .formatFullDate(booking.scheduledAt!),
          ),
        _InfoRow(
          label: l10n.bookingAddressLabel,
          value: booking.serviceAddress,
        ),
        if (booking.customerNotes != null)
          _InfoRow(
            label: l10n.bookingNotesLabel,
            value: booking.customerNotes!,
          ),
        if (!isCustomer)
          _InfoRow(
            label: l10n.bookingCustomerLabel,
            value: booking.customer.fullName ?? l10n.bookingNameUnknown,
          ),
        if (booking.provider != null && !isAssignedProvider)
          _InfoRow(
            key: const Key('provider_name'),
            label: l10n.bookingProviderLabel,
            value: booking.provider!.fullName ?? l10n.bookingNameUnknown,
          ),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.bookingTimelineLabel, style: textTheme.titleMedium),
        const SizedBox(height: AppSpacing.xs),
        _Timeline(booking: booking),
        if (isCustomer) ...[
          const SizedBox(height: AppSpacing.lg),
          _CustomerActions(booking: booking),
        ],
        if (isAssignedProvider) ...[
          const SizedBox(height: AppSpacing.lg),
          _ProviderActions(booking: booking),
        ],
        if (isCandidateProvider) ...[
          const SizedBox(height: AppSpacing.lg),
          _CandidateProviderActions(booking: booking),
        ],
        if (booking.isQuotePriced && (isCustomer || isCandidateProvider)) ...[
          const SizedBox(height: AppSpacing.lg),
          Text(l10n.bookingQuotesTitle, style: textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          if (booking.quotes.isEmpty)
            Text(l10n.bookingNoQuotesYet, key: const Key('no_quotes'))
          else
            for (final quote in booking.quotes) ...[
              _QuoteCard(
                booking: booking,
                quote: quote,
                isCustomer: isCustomer,
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
        ],
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, super.key});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: textTheme.labelMedium),
          Text(value, style: textTheme.bodyLarge),
        ],
      ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = booking.timestamps;
    final steps = <(String, DateTime?)>[
      (l10n.bookingStatusAccepted, t.acceptedAt),
      (l10n.bookingStatusEnRoute, t.enRouteAt),
      (l10n.bookingStatusArrived, t.arrivedAt),
      (l10n.bookingStatusInProgress, t.workStartedAt),
      (l10n.bookingStatusCompleted, t.completedAt),
    ];
    final reached = steps.where((s) => s.$2 != null).toList();
    if (reached.isEmpty) {
      return Text(l10n.bookingTimelineEmpty);
    }
    final format = MaterialLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (label, at) in reached)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: Row(
              children: [
                const Icon(Icons.check_circle, size: 16),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '$label — ${format.formatTimeOfDay(TimeOfDay.fromDateTime(at!))}',
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _CustomerActions extends ConsumerStatefulWidget {
  const _CustomerActions({required this.booking});

  final Booking booking;

  @override
  ConsumerState<_CustomerActions> createState() => _CustomerActionsState();
}

class _CustomerActionsState extends ConsumerState<_CustomerActions> {
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

  Future<void> _confirmCancel() async {
    final l10n = AppLocalizations.of(context);
    final reason = await showReasonDialog(
      context: context,
      title: l10n.bookingCancelTitle,
      body: l10n.bookingCancelBody,
      reasonLabel: l10n.bookingCancelReasonLabel,
      confirmLabel: l10n.bookingCancel,
    );
    if (reason == null || !mounted) return;
    await _run(
      () => ref
          .read(bookingDetailProvider(widget.booking.id).notifier)
          .cancel(reason),
      l10n.bookingCancelled,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (!widget.booking.isCancellable) return const SizedBox.shrink();
    return OutlinedButton(
      key: const Key('cancel_booking_button'),
      onPressed: _busy ? null : _confirmCancel,
      child: Text(l10n.bookingCancel),
    );
  }
}

class _ProviderActions extends ConsumerStatefulWidget {
  const _ProviderActions({required this.booking});

  final Booking booking;

  @override
  ConsumerState<_ProviderActions> createState() => _ProviderActionsState();
}

class _ProviderActionsState extends ConsumerState<_ProviderActions> {
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

  Future<void> _confirmRelease() async {
    final l10n = AppLocalizations.of(context);
    final reason = await showReasonDialog(
      context: context,
      title: l10n.bookingReleaseTitle,
      body: l10n.bookingReleaseBody,
      reasonLabel: l10n.bookingReleaseReasonLabel,
      confirmLabel: l10n.bookingRelease,
    );
    if (reason == null || !mounted) return;
    await _run(
      () => ref
          .read(bookingDetailProvider(widget.booking.id).notifier)
          .release(reason),
      l10n.bookingReleased,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final controller = ref.read(
      bookingDetailProvider(widget.booking.id).notifier,
    );
    final primary = switch (widget.booking.status) {
      BookingStatus.accepted => (
        key: 'start_en_route_button',
        label: l10n.bookingStartEnRoute,
        successMessage: l10n.bookingEnRouteStarted,
        action: controller.startEnRoute,
      ),
      BookingStatus.enRoute => (
        key: 'mark_arrived_button',
        label: l10n.bookingMarkArrived,
        successMessage: l10n.bookingArrivedMarked,
        action: controller.markArrived,
      ),
      BookingStatus.arrived => (
        key: 'start_work_button',
        label: l10n.bookingStartWork,
        successMessage: l10n.bookingWorkStarted,
        action: controller.startWork,
      ),
      BookingStatus.inProgress => (
        key: 'complete_button',
        label: l10n.bookingComplete,
        successMessage: l10n.bookingCompletedMessage,
        action: controller.complete,
      ),
      _ => null,
    };

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        if (primary != null)
          FilledButton(
            key: Key(primary.key),
            onPressed: _busy
                ? null
                : () => _run(primary.action, primary.successMessage),
            child: Text(primary.label),
          ),
        if (widget.booking.isReleasable)
          OutlinedButton(
            key: const Key('release_booking_button'),
            onPressed: _busy ? null : _confirmRelease,
            child: Text(l10n.bookingRelease),
          ),
      ],
    );
  }
}

class _CandidateProviderActions extends ConsumerStatefulWidget {
  const _CandidateProviderActions({required this.booking});

  final Booking booking;

  @override
  ConsumerState<_CandidateProviderActions> createState() =>
      _CandidateProviderActionsState();
}

class _CandidateProviderActionsState
    extends ConsumerState<_CandidateProviderActions> {
  bool _busy = false;

  Future<void> _accept() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await ref
          .read(bookingDetailProvider(widget.booking.id).notifier)
          .accept();
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.bookingAcceptedMessage)),
      );
    } on Object catch (error) {
      messenger.showSnackBar(
        SnackBar(content: Text(errorMessage(l10n, error))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitQuote() async {
    final l10n = AppLocalizations.of(context);
    final result = await showQuoteDialog(context: context);
    if (result == null || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await ref
          .read(bookingDetailProvider(widget.booking.id).notifier)
          .submitQuote(amount: result.amount, note: result.note);
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.bookingQuoteSubmitted)),
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
    if (widget.booking.isQuotePriced) {
      final alreadyQuoted = widget.booking.quotes.isNotEmpty;
      if (alreadyQuoted) return const SizedBox.shrink();
      return FilledButton(
        key: const Key('submit_quote_button'),
        onPressed: _busy ? null : _submitQuote,
        child: Text(l10n.bookingSubmitQuote),
      );
    }
    return FilledButton(
      key: const Key('accept_booking_button'),
      onPressed: _busy ? null : _accept,
      child: Text(l10n.bookingAcceptJob),
    );
  }
}

class _QuoteCard extends ConsumerStatefulWidget {
  const _QuoteCard({
    required this.booking,
    required this.quote,
    required this.isCustomer,
  });

  final Booking booking;
  final Quote quote;
  final bool isCustomer;

  @override
  ConsumerState<_QuoteCard> createState() => _QuoteCardState();
}

class _QuoteCardState extends ConsumerState<_QuoteCard> {
  bool _busy = false;

  Future<void> _decide(
    Future<void> Function(String quoteId) action,
    String successMessage,
  ) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await action(widget.quote.id);
      messenger.showSnackBar(SnackBar(content: Text(successMessage)));
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
    final quote = widget.quote;
    final controller = ref.read(
      bookingDetailProvider(widget.booking.id).notifier,
    );

    return Card(
      key: Key('quote_${quote.id}'),
      margin: EdgeInsets.zero,
      child: Padding(
        padding: AppSpacing.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.isCustomer)
              Text(
                quote.providerName ?? l10n.bookingNameUnknown,
                style: textTheme.titleSmall,
              ),
            Text(
              l10n.bookingAmountLkr(quote.amount),
              style: textTheme.titleMedium,
            ),
            if (quote.note != null) Text(quote.note!),
            const SizedBox(height: AppSpacing.xs),
            StatusChip(
              label: quote.status.label(l10n),
              icon: quote.status.icon,
              tone: quote.status.tone,
            ),
            if (widget.isCustomer && quote.status == QuoteStatus.pending) ...[
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  FilledButton(
                    key: Key('accept_quote_${quote.id}'),
                    onPressed: _busy
                        ? null
                        : () => _decide(
                            controller.acceptQuote,
                            l10n.bookingQuoteAccepted,
                          ),
                    child: Text(l10n.bookingAcceptQuote),
                  ),
                  TextButton(
                    key: Key('reject_quote_${quote.id}'),
                    onPressed: _busy
                        ? null
                        : () => _decide(
                            controller.rejectQuote,
                            l10n.bookingQuoteRejected,
                          ),
                    child: Text(l10n.bookingRejectQuote),
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

/// A reason dialog for cancelling or releasing a booking. Returns the trimmed
/// reason, or null if the person backed out or left it blank.
Future<String?> showReasonDialog({
  required BuildContext context,
  required String title,
  required String body,
  required String reasonLabel,
  required String confirmLabel,
}) {
  final l10n = AppLocalizations.of(context);
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(body),
          const SizedBox(height: AppSpacing.md),
          TextField(
            key: const Key('reason_field'),
            controller: controller,
            autofocus: true,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: reasonLabel,
              border: const OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          key: const Key('reason_dialog_cancel'),
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.commonCancel),
        ),
        FilledButton(
          key: const Key('reason_dialog_confirm'),
          onPressed: () {
            final reason = controller.text.trim();
            if (reason.isEmpty) return;
            Navigator.of(context).pop(reason);
          },
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
}

/// What a provider entered when submitting a quote.
typedef QuoteInput = ({double amount, String? note});

Future<QuoteInput?> showQuoteDialog({required BuildContext context}) {
  final l10n = AppLocalizations.of(context);
  final amountController = TextEditingController();
  final noteController = TextEditingController();
  final formKey = GlobalKey<FormState>();

  return showDialog<QuoteInput>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(l10n.bookingSubmitQuote),
      content: Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              key: const Key('quote_amount_field'),
              controller: amountController,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                labelText: l10n.bookingQuoteAmountLabel,
                prefixText: 'LKR ',
                border: const OutlineInputBorder(),
              ),
              validator: (value) {
                final amount = double.tryParse(value?.trim() ?? '');
                if (amount == null || amount <= 0) {
                  return l10n.bookingQuoteAmountInvalid;
                }
                return null;
              },
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              key: const Key('quote_note_field'),
              controller: noteController,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: l10n.bookingQuoteNoteLabel,
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          key: const Key('quote_dialog_cancel'),
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.commonCancel),
        ),
        FilledButton(
          key: const Key('quote_dialog_confirm'),
          onPressed: () {
            if (!(formKey.currentState?.validate() ?? false)) return;
            final amount = double.parse(amountController.text.trim());
            final note = noteController.text.trim();
            Navigator.of(context)
                .pop((amount: amount, note: note.isEmpty ? null : note));
          },
          child: Text(l10n.bookingQuoteSubmit),
        ),
      ],
    ),
  );
}
