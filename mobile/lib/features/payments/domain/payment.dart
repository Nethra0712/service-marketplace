import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/payments/domain/payment_status.dart';

/// One payment attempt for a completed booking. Every amount here is
/// server-computed (see `payments.service.ts`'s doc comment on the backend):
/// this app never calculates commission or displays a client-guessed figure.
class Payment {
  const Payment({
    required this.id,
    required this.bookingId,
    required this.status,
    required this.serviceAmount,
    required this.commissionAmount,
    required this.providerEarningAmount,
    required this.currency,
    required this.externalReference,
    required this.createdAt,
    this.providerPaymentId,
    this.succeededAt,
    this.failedAt,
    this.cancelledAt,
    this.refundedAt,
  });

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
    id: readString(json, 'id'),
    bookingId: readString(json, 'bookingId'),
    status: readEnum(PaymentStatus.values, json, 'status'),
    serviceAmount: readString(json, 'serviceAmount'),
    commissionAmount: readString(json, 'commissionAmount'),
    providerEarningAmount: readString(json, 'providerEarningAmount'),
    currency: readString(json, 'currency'),
    externalReference: readString(json, 'externalReference'),
    providerPaymentId: readStringOrNull(json, 'providerPaymentId'),
    createdAt: DateTime.parse(readString(json, 'createdAt')),
    succeededAt: readDateTimeOrNull(json, 'succeededAt'),
    failedAt: readDateTimeOrNull(json, 'failedAt'),
    cancelledAt: readDateTimeOrNull(json, 'cancelledAt'),
    refundedAt: readDateTimeOrNull(json, 'refundedAt'),
  );

  final String id;
  final String bookingId;
  final PaymentStatus status;

  /// Decimal strings, e.g. `"250.00"`, LKR (or [currency]).
  final String serviceAmount;
  final String commissionAmount;
  final String providerEarningAmount;
  final String currency;

  /// This app's own reference for the payment attempt (the gateway's order id).
  final String externalReference;

  /// The gateway's own id for the payment, once it has reported one.
  final String? providerPaymentId;

  final DateTime createdAt;
  final DateTime? succeededAt;
  final DateTime? failedAt;
  final DateTime? cancelledAt;
  final DateTime? refundedAt;
}

/// What a checkout needs handed to the gateway. For a form-POST gateway
/// (PayHere), [fields] are the form fields; opening [checkoutUrl] directly
/// (a plain GET, no POST body) is what this app does today, which works for
/// the mock provider used everywhere in this environment. A real PayHere
/// checkout needs those fields actually POSTed — an auto-submitting page in
/// a WebView, or an equivalent — which is not implemented yet; see
/// `CheckoutScreen`'s own doc comment.
class CheckoutSession {
  const CheckoutSession({required this.checkoutUrl, required this.fields});

  factory CheckoutSession.fromJson(Map<String, dynamic> json) {
    final rawFields = json['fields'];
    if (rawFields is! Map) {
      throw const FormatException('"fields" is not an object.');
    }
    return CheckoutSession(
      checkoutUrl: readString(json, 'checkoutUrl'),
      fields: {
        for (final entry in rawFields.entries)
          entry.key as String: entry.value as String,
      },
    );
  }

  final String checkoutUrl;
  final Map<String, String> fields;
}
