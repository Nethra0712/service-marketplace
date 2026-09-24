import 'package:mobile/features/payments/domain/payment.dart';

/// Payment self-service for a completed booking's customer and its assigned
/// provider. There is no client-side commission math or amount entry here:
/// every figure comes back from the server (see `Payment`'s doc comment).
/// Refunds and payouts are deliberately absent — the backend does not expose
/// them over HTTP either; see `payments.service.ts`'s doc comment.
abstract interface class PaymentRepository {
  /// Starts (or resumes/retries) paying for a completed booking. Customer-only.
  Future<CheckoutSession> createCheckout(String bookingId);

  /// The current payment for a booking, for its customer or assigned
  /// provider. Returns null if the booking has not been completed yet (there
  /// is genuinely nothing to show) rather than throwing.
  Future<Payment?> getPayment(String bookingId);
}
