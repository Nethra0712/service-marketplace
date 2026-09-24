import 'package:flutter/material.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/widgets/status_chip.dart';
import 'package:mobile/features/payments/domain/payment_status.dart';

extension PaymentStatusLabels on PaymentStatus {
  String label(AppLocalizations l10n) => switch (this) {
    PaymentStatus.pending => l10n.paymentStatusPending,
    PaymentStatus.succeeded => l10n.paymentStatusSucceeded,
    PaymentStatus.failed => l10n.paymentStatusFailed,
    PaymentStatus.cancelled => l10n.paymentStatusCancelled,
    PaymentStatus.refunded => l10n.paymentStatusRefunded,
  };

  IconData get icon => switch (this) {
    PaymentStatus.pending => Icons.hourglass_top,
    PaymentStatus.succeeded => Icons.check_circle,
    PaymentStatus.failed => Icons.error_outline,
    PaymentStatus.cancelled => Icons.cancel_outlined,
    PaymentStatus.refunded => Icons.undo,
  };

  StatusTone get tone => switch (this) {
    PaymentStatus.succeeded => StatusTone.good,
    PaymentStatus.failed || PaymentStatus.cancelled => StatusTone.bad,
    PaymentStatus.pending || PaymentStatus.refunded => StatusTone.neutral,
  };

  /// Whether a "pay now"/"try again" action makes sense from this state.
  bool get isPayable => switch (this) {
    PaymentStatus.pending ||
    PaymentStatus.failed ||
    PaymentStatus.cancelled => true,
    PaymentStatus.succeeded || PaymentStatus.refunded => false,
  };
}
