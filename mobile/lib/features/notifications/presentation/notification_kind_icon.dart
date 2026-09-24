import 'package:flutter/material.dart';
import 'package:mobile/features/notifications/domain/notification_kind.dart';

/// A per-kind icon for quick visual scanning in the notification list. The
/// title/body text is already server-composed (see `AppNotification`'s doc
/// comment); this is purely decorative, so it needs no localization.
extension NotificationKindIcon on NotificationKind {
  IconData get icon => switch (this) {
    NotificationKind.bookingAccepted => Icons.check_circle_outline,
    NotificationKind.providerEnRoute => Icons.directions_car_outlined,
    NotificationKind.providerArrived => Icons.location_on_outlined,
    NotificationKind.bookingCompleted => Icons.task_alt,
    NotificationKind.bookingCancelled => Icons.cancel_outlined,
    NotificationKind.quoteCreated => Icons.request_quote_outlined,
    NotificationKind.quoteAccepted => Icons.thumb_up_outlined,
    NotificationKind.quoteRejected => Icons.thumb_down_outlined,
    NotificationKind.paymentSucceeded => Icons.payments_outlined,
    NotificationKind.paymentFailed => Icons.error_outline,
    NotificationKind.payoutPaid => Icons.account_balance_wallet_outlined,
  };
}
