/// Every event the app can notify someone about. Mirrors the backend's
/// `notification_kind`, whose values are snake_case, unlike this enum's
/// camelCase names, so parsing goes through [NotificationKind.fromWire]
/// rather than the shared `readEnum` helper (see `BookingStatus` for the
/// same pattern).
enum NotificationKind {
  bookingAccepted,
  providerEnRoute,
  providerArrived,
  bookingCompleted,
  bookingCancelled,
  quoteCreated,
  quoteAccepted,
  quoteRejected,
  paymentSucceeded,
  paymentFailed,
  payoutPaid;

  static NotificationKind fromWire(String value) => switch (value) {
    'booking_accepted' => NotificationKind.bookingAccepted,
    'provider_en_route' => NotificationKind.providerEnRoute,
    'provider_arrived' => NotificationKind.providerArrived,
    'booking_completed' => NotificationKind.bookingCompleted,
    'booking_cancelled' => NotificationKind.bookingCancelled,
    'quote_created' => NotificationKind.quoteCreated,
    'quote_accepted' => NotificationKind.quoteAccepted,
    'quote_rejected' => NotificationKind.quoteRejected,
    'payment_succeeded' => NotificationKind.paymentSucceeded,
    'payment_failed' => NotificationKind.paymentFailed,
    'payout_paid' => NotificationKind.payoutPaid,
    _ => throw FormatException('Unknown notification kind "$value".'),
  };

  /// Whether this event is about a booking (and so `Notification.bookingId`
  /// is where tapping it should navigate to). Only a payout has no booking.
  bool get isBookingRelated => this != NotificationKind.payoutPaid;
}
