import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/notifications/domain/notification.dart';
import 'package:mobile/features/notifications/domain/notification_kind.dart';

void main() {
  group('AppNotification.fromJson', () {
    test('parses an unread booking notification', () {
      final notification = AppNotification.fromJson({
        'id': 'n1',
        'kind': 'booking_accepted',
        'title': 'Booking accepted',
        'body': 'A provider has accepted your booking.',
        'bookingId': 'b1',
        'paymentId': null,
        'payoutId': null,
        'readAt': null,
        'createdAt': '2026-01-01T11:00:00.000Z',
      });

      expect(notification.kind, NotificationKind.bookingAccepted);
      expect(notification.bookingId, 'b1');
      expect(notification.isUnread, isTrue);
    });

    test('parses a read notification', () {
      final notification = AppNotification.fromJson({
        'id': 'n1',
        'kind': 'payout_paid',
        'title': 'Payout sent',
        'body': 'Your payout of 212.50 LKR has been sent.',
        'bookingId': null,
        'paymentId': null,
        'payoutId': 'payout-1',
        'readAt': '2026-01-01T12:00:00.000Z',
        'createdAt': '2026-01-01T11:00:00.000Z',
      });

      expect(notification.isUnread, isFalse);
      expect(notification.payoutId, 'payout-1');
      expect(notification.kind.isBookingRelated, isFalse);
    });

    test('throws on an unknown kind (a newer server than this app)', () {
      expect(
        () => AppNotification.fromJson({
          'id': 'n1',
          'kind': 'some_future_kind',
          'title': 'x',
          'body': 'y',
          'createdAt': '2026-01-01T11:00:00.000Z',
        }),
        throwsFormatException,
      );
    });
  });

  group('NotificationKind.isBookingRelated', () {
    test('true for booking, quote and payment events', () {
      for (final kind in [
        NotificationKind.bookingAccepted,
        NotificationKind.providerEnRoute,
        NotificationKind.providerArrived,
        NotificationKind.bookingCompleted,
        NotificationKind.bookingCancelled,
        NotificationKind.quoteCreated,
        NotificationKind.quoteAccepted,
        NotificationKind.quoteRejected,
        NotificationKind.paymentSucceeded,
        NotificationKind.paymentFailed,
      ]) {
        expect(kind.isBookingRelated, isTrue, reason: kind.name);
      }
    });

    test('false for a payout, which has no booking', () {
      expect(NotificationKind.payoutPaid.isBookingRelated, isFalse);
    });
  });
}
