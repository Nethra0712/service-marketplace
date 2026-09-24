import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/payments/domain/payment.dart';
import 'package:mobile/features/payments/domain/payment_status.dart';

void main() {
  group('Payment.fromJson', () {
    test('parses a pending payment', () {
      final payment = Payment.fromJson({
        'id': 'payment-1',
        'bookingId': 'b1',
        'status': 'pending',
        'serviceAmount': '250.00',
        'commissionAmount': '37.50',
        'providerEarningAmount': '212.50',
        'currency': 'LKR',
        'externalReference': 'SM-1',
        'providerPaymentId': null,
        'succeededAt': null,
        'failedAt': null,
        'cancelledAt': null,
        'refundedAt': null,
        'createdAt': '2026-01-01T11:00:00.000Z',
      });

      expect(payment.status, PaymentStatus.pending);
      expect(payment.serviceAmount, '250.00');
      expect(payment.commissionAmount, '37.50');
      expect(payment.providerEarningAmount, '212.50');
      expect(payment.providerPaymentId, isNull);
      expect(payment.succeededAt, isNull);
    });

    test(
      'parses a succeeded payment with its gateway reference and timestamp',
      () {
        final payment = Payment.fromJson({
          'id': 'payment-1',
          'bookingId': 'b1',
          'status': 'succeeded',
          'serviceAmount': '250.00',
          'commissionAmount': '37.50',
          'providerEarningAmount': '212.50',
          'currency': 'LKR',
          'externalReference': 'SM-1',
          'providerPaymentId': 'gateway-ref-1',
          'succeededAt': '2026-01-01T11:05:00.000Z',
          'failedAt': null,
          'cancelledAt': null,
          'refundedAt': null,
          'createdAt': '2026-01-01T11:00:00.000Z',
        });

        expect(payment.status, PaymentStatus.succeeded);
        expect(payment.providerPaymentId, 'gateway-ref-1');
        expect(payment.succeededAt, DateTime.parse('2026-01-01T11:05:00.000Z'));
      },
    );

    test('throws on an unknown status (a newer server than this app)', () {
      expect(
        () => Payment.fromJson({
          'id': 'payment-1',
          'bookingId': 'b1',
          'status': 'some-future-status',
          'serviceAmount': '250.00',
          'commissionAmount': '37.50',
          'providerEarningAmount': '212.50',
          'currency': 'LKR',
          'externalReference': 'SM-1',
          'createdAt': '2026-01-01T11:00:00.000Z',
        }),
        throwsFormatException,
      );
    });
  });

  group('CheckoutSession.fromJson', () {
    test('parses the checkout url and fields', () {
      final session = CheckoutSession.fromJson({
        'checkoutUrl': 'mock://checkout/SM-1',
        'fields': {'orderId': 'SM-1', 'amount': '250.00'},
      });

      expect(session.checkoutUrl, 'mock://checkout/SM-1');
      expect(session.fields, {'orderId': 'SM-1', 'amount': '250.00'});
    });

    test('throws when fields is not an object', () {
      expect(
        () => CheckoutSession.fromJson({
          'checkoutUrl': 'mock://checkout/SM-1',
          'fields': 'not-an-object',
        }),
        throwsFormatException,
      );
    });
  });
}
