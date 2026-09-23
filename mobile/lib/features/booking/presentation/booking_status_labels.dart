import 'package:flutter/material.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/widgets/status_chip.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/booking/domain/quote.dart';

extension BookingStatusLabels on BookingStatus {
  String label(AppLocalizations l10n) => switch (this) {
    BookingStatus.searching => l10n.bookingStatusSearching,
    BookingStatus.accepted => l10n.bookingStatusAccepted,
    BookingStatus.enRoute => l10n.bookingStatusEnRoute,
    BookingStatus.arrived => l10n.bookingStatusArrived,
    BookingStatus.inProgress => l10n.bookingStatusInProgress,
    BookingStatus.completed => l10n.bookingStatusCompleted,
    BookingStatus.cancelled => l10n.bookingStatusCancelled,
  };

  String help(AppLocalizations l10n) => switch (this) {
    BookingStatus.searching => l10n.bookingStatusSearchingHelp,
    BookingStatus.accepted => l10n.bookingStatusAcceptedHelp,
    BookingStatus.enRoute => l10n.bookingStatusEnRouteHelp,
    BookingStatus.arrived => l10n.bookingStatusArrivedHelp,
    BookingStatus.inProgress => l10n.bookingStatusInProgressHelp,
    BookingStatus.completed => l10n.bookingStatusCompletedHelp,
    BookingStatus.cancelled => l10n.bookingStatusCancelledHelp,
  };

  IconData get icon => switch (this) {
    BookingStatus.searching => Icons.search,
    BookingStatus.accepted => Icons.check_circle_outline,
    BookingStatus.enRoute => Icons.directions_car_outlined,
    BookingStatus.arrived => Icons.pin_drop_outlined,
    BookingStatus.inProgress => Icons.build_outlined,
    BookingStatus.completed => Icons.check_circle,
    BookingStatus.cancelled => Icons.cancel_outlined,
  };

  StatusTone get tone => switch (this) {
    BookingStatus.completed => StatusTone.good,
    BookingStatus.cancelled => StatusTone.bad,
    _ => StatusTone.neutral,
  };
}

extension QuoteStatusLabels on QuoteStatus {
  String label(AppLocalizations l10n) => switch (this) {
    QuoteStatus.pending => l10n.quoteStatusPending,
    QuoteStatus.accepted => l10n.quoteStatusAccepted,
    QuoteStatus.rejected => l10n.quoteStatusRejected,
  };

  IconData get icon => switch (this) {
    QuoteStatus.pending => Icons.hourglass_top,
    QuoteStatus.accepted => Icons.check_circle,
    QuoteStatus.rejected => Icons.cancel_outlined,
  };

  StatusTone get tone => switch (this) {
    QuoteStatus.accepted => StatusTone.good,
    QuoteStatus.rejected => StatusTone.bad,
    QuoteStatus.pending => StatusTone.neutral,
  };
}
