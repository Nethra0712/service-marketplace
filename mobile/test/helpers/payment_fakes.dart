import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/payments/domain/payment.dart';
import 'package:mobile/features/payments/domain/payment_repository.dart';
import 'package:mobile/features/payments/domain/payment_status.dart';

/// A payment fixture, built the way a real server response would look.
Payment paymentOf({
  String id = 'payment-1',
  String bookingId = 'b1',
  PaymentStatus status = PaymentStatus.pending,
  String serviceAmount = '250.00',
  String commissionAmount = '37.50',
  String providerEarningAmount = '212.50',
  String currency = 'LKR',
  String externalReference = 'SM-1',
  String? providerPaymentId,
  DateTime? succeededAt,
  DateTime? failedAt,
  DateTime? cancelledAt,
  DateTime? refundedAt,
}) => Payment(
  id: id,
  bookingId: bookingId,
  status: status,
  serviceAmount: serviceAmount,
  commissionAmount: commissionAmount,
  providerEarningAmount: providerEarningAmount,
  currency: currency,
  externalReference: externalReference,
  providerPaymentId: providerPaymentId,
  createdAt: DateTime.utc(2026, 1, 1, 11),
  succeededAt: succeededAt,
  failedAt: failedAt,
  cancelledAt: cancelledAt,
  refundedAt: refundedAt,
);

/// An in-memory [PaymentRepository]. Tests seed [payments] keyed by booking
/// id and record what the app asked it to do, the same way
/// `FakeBookingRepository` works for bookings.
class FakePaymentRepository implements PaymentRepository {
  final Map<String, Payment> payments = {};

  /// Scripted failure for the next call to a method (by name), used once.
  final Map<String, AppException> failures = {};

  final checkoutCalls = <String>[];

  /// What `createCheckout` returns; defaults to a mock-shaped session built
  /// from the booking's current payment, if any.
  CheckoutSession Function(String bookingId)? onCreateCheckout;

  void _maybeFail(String method) {
    final failure = failures.remove(method);
    if (failure != null) throw failure;
  }

  @override
  Future<CheckoutSession> createCheckout(String bookingId) async {
    checkoutCalls.add(bookingId);
    _maybeFail('createCheckout');
    final handler = onCreateCheckout;
    if (handler != null) return handler(bookingId);
    final payment = payments[bookingId];
    final reference = payment?.externalReference ?? 'SM-$bookingId';
    return CheckoutSession(
      checkoutUrl: 'mock://checkout/$reference',
      fields: {'orderId': reference, 'amount': payment?.serviceAmount ?? '0'},
    );
  }

  @override
  Future<Payment?> getPayment(String bookingId) async {
    _maybeFail('getPayment');
    return payments[bookingId];
  }
}
