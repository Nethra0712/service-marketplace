import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/errors/error_message.dart';
import 'package:mobile/core/navigation/navigation_providers.dart';
import 'package:mobile/core/widgets/status_chip.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/payments/application/payment_providers.dart';
import 'package:mobile/features/payments/domain/payment.dart';
import 'package:mobile/features/payments/domain/payment_status.dart';
import 'package:mobile/features/payments/presentation/payment_status_labels.dart';

/// Payment for a completed booking, shown on its detail screen. Shows the
/// same server-computed breakdown to both sides (the customer pays it, the
/// provider is owed part of it — see the brief's own worked example), and
/// gives the customer a way to pay/retry. There is nothing to show before
/// the booking is `completed`: no payment exists yet (see
/// `PaymentRepository.getPayment`).
class PaymentSection extends ConsumerWidget {
  const PaymentSection({
    required this.booking,
    required this.isCustomer,
    super.key,
  });

  final Booking booking;
  final bool isCustomer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (booking.status != BookingStatus.completed) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final paymentState = ref.watch(bookingPaymentProvider(booking.id));

    return Card(
      child: Padding(
        padding: AppSpacing.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.paymentSectionTitle, style: textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            paymentState.when(
              skipLoadingOnReload: true,
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text(
                errorMessage(l10n, error),
                key: const Key('payment_error'),
              ),
              data: (payment) => payment == null
                  ? const SizedBox.shrink()
                  : _PaymentDetails(
                      bookingId: booking.id,
                      payment: payment,
                      isCustomer: isCustomer,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentDetails extends ConsumerStatefulWidget {
  const _PaymentDetails({
    required this.bookingId,
    required this.payment,
    required this.isCustomer,
  });

  final String bookingId;
  final Payment payment;
  final bool isCustomer;

  @override
  ConsumerState<_PaymentDetails> createState() => _PaymentDetailsState();
}

class _PaymentDetailsState extends ConsumerState<_PaymentDetails> {
  bool _busy = false;

  Future<void> _pay() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final session = await ref
          .read(bookingPaymentProvider(widget.bookingId).notifier)
          .createCheckout();
      final opened = await ref
          .read(urlLauncherServiceProvider)
          .launch(Uri.parse(session.checkoutUrl));
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            opened
                ? l10n.paymentCheckoutOpened
                : l10n.paymentCheckoutOpenFailed,
          ),
        ),
      );
    } on Object catch (error) {
      if (!mounted) return;
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
    final payment = widget.payment;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        StatusChip(
          key: const Key('payment_status'),
          label: payment.status.label(l10n),
          icon: payment.status.icon,
          tone: payment.status.tone,
        ),
        const SizedBox(height: AppSpacing.sm),
        _AmountRow(
          label: l10n.paymentServiceAmountLabel,
          amount: payment.serviceAmount,
        ),
        _AmountRow(
          label: l10n.paymentCommissionLabel,
          amount: payment.commissionAmount,
        ),
        _AmountRow(
          key: const Key('provider_earning_row'),
          label: l10n.paymentProviderEarningLabel,
          amount: payment.providerEarningAmount,
        ),
        if (widget.isCustomer && payment.status.isPayable) ...[
          const SizedBox(height: AppSpacing.sm),
          FilledButton(
            key: const Key('pay_now_button'),
            onPressed: _busy ? null : () => unawaited(_pay()),
            child: Text(
              payment.status == PaymentStatus.pending
                  ? l10n.paymentPayNow
                  : l10n.paymentRetry,
            ),
          ),
        ],
      ],
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({required this.label, required this.amount, super.key});

  final String label;
  final String amount;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: textTheme.bodyMedium),
          Text(l10n.bookingAmountLkr(amount), style: textTheme.bodyMedium),
        ],
      ),
    );
  }
}
