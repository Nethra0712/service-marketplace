import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/payments/domain/payment.dart';
import 'package:mobile/features/payments/domain/payment_repository.dart';

/// [PaymentRepository] backed by the platform API.
class PaymentApiRepository implements PaymentRepository {
  PaymentApiRepository(this._api);

  final ApiClient _api;

  @override
  Future<CheckoutSession> createCheckout(String bookingId) async {
    final data = await _api.post(
      '/api/bookings/${Uri.encodeComponent(bookingId)}/payment/checkout',
    );
    return parseResponse(() => CheckoutSession.fromJson(asJsonObject(data)));
  }

  @override
  Future<Payment?> getPayment(String bookingId) async {
    final Object? data;
    try {
      data = await _api.get(
        '/api/bookings/${Uri.encodeComponent(bookingId)}/payment',
      );
    } on NotFoundException {
      // Not completed yet (or, on the provider side, not this provider's
      // booking) — nothing to show, not an error.
      return null;
    }
    return parseResponse(() => Payment.fromJson(asJsonObject(data)));
  }
}
