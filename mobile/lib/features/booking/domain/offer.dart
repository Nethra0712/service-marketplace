import 'package:mobile/core/network/json_helpers.dart';

/// Where one provider's dispatch offer on a booking currently stands. Mirrors
/// the backend's `booking_offer_status`.
enum OfferStatus {
  pending,
  accepted,
  declined,
  expired,
  superseded;

  static OfferStatus fromWire(String value) => switch (value) {
    'pending' => OfferStatus.pending,
    'accepted' => OfferStatus.accepted,
    'declined' => OfferStatus.declined,
    'expired' => OfferStatus.expired,
    'superseded' => OfferStatus.superseded,
    _ => throw FormatException('Unknown offer status "$value".'),
  };
}

/// A provider's own dispatch offer on a booking, automatic matching's way of
/// inviting them to accept or quote it. A provider only ever sees their own
/// offer, never anyone else's.
class Offer {
  const Offer({
    required this.status,
    required this.wave,
    required this.respondsBy,
    this.distanceKm,
  });

  factory Offer.fromJson(Map<String, dynamic> json) => Offer(
    status: OfferStatus.fromWire(readString(json, 'status')),
    wave: readInt(json, 'wave'),
    respondsBy: DateTime.parse(readString(json, 'respondsBy')),
    distanceKm: readStringOrNull(json, 'distanceKm'),
  );

  final OfferStatus status;

  /// 1-based dispatch wave this offer was made in.
  final int wave;

  /// This offer lapses if not answered by this time.
  final DateTime respondsBy;

  /// Straight-line distance from the job, in km, if known.
  final String? distanceKm;

  bool get isPending => status == OfferStatus.pending;
}
