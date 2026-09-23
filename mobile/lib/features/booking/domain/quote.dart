import 'package:mobile/core/network/json_helpers.dart';

/// A provider's proposed price for a quote-priced booking.
enum QuoteStatus { pending, accepted, rejected }

/// One provider's quote on a booking. A customer sees every quote on their
/// booking; a provider sees only their own (never a competitor's price).
class Quote {
  const Quote({
    required this.id,
    required this.status,
    required this.amount,
    required this.providerId,
    required this.providerName,
    required this.createdAt,
    this.note,
    this.respondedAt,
  });

  factory Quote.fromJson(Map<String, dynamic> json) {
    final provider = asJsonObject(json['provider']);
    return Quote(
      id: readString(json, 'id'),
      status: readEnum(QuoteStatus.values, json, 'status'),
      amount: readString(json, 'amount'),
      note: readStringOrNull(json, 'note'),
      providerId: readString(provider, 'id'),
      providerName: readStringOrNull(provider, 'fullName'),
      createdAt: DateTime.parse(readString(json, 'createdAt')),
      respondedAt: readDateTimeOrNull(json, 'respondedAt'),
    );
  }

  final String id;
  final QuoteStatus status;

  /// A decimal string, e.g. `"3500.00"`, LKR. Kept as text (not parsed to a
  /// number) since this app only ever displays it, never computes with it.
  final String amount;
  final String? note;
  final String providerId;
  final String? providerName;
  final DateTime createdAt;
  final DateTime? respondedAt;
}
