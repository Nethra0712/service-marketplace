import 'package:mobile/core/network/json_helpers.dart';

/// A booking's stage. Mirrors the backend's `booking_status`, whose values are
/// snake_case (`en_route`, `in_progress`) unlike this enum's camelCase names,
/// so parsing goes through [BookingStatus.fromWire] rather than [readEnum].
enum BookingStatus {
  searching,
  accepted,
  enRoute,
  arrived,
  inProgress,
  completed,
  cancelled,
  expired;

  static BookingStatus fromWire(String value) => switch (value) {
    'searching' => BookingStatus.searching,
    'accepted' => BookingStatus.accepted,
    'en_route' => BookingStatus.enRoute,
    'arrived' => BookingStatus.arrived,
    'in_progress' => BookingStatus.inProgress,
    'completed' => BookingStatus.completed,
    'cancelled' => BookingStatus.cancelled,
    'expired' => BookingStatus.expired,
    _ => throw FormatException('Unknown booking status "$value".'),
  };

  String get wireValue => switch (this) {
    BookingStatus.searching => 'searching',
    BookingStatus.accepted => 'accepted',
    BookingStatus.enRoute => 'en_route',
    BookingStatus.arrived => 'arrived',
    BookingStatus.inProgress => 'in_progress',
    BookingStatus.completed => 'completed',
    BookingStatus.cancelled => 'cancelled',
    BookingStatus.expired => 'expired',
  };
}

/// Whether the customer wants the work now or at a chosen time. Mirrors the
/// backend's `booking_type` (`on_demand`, `scheduled`).
enum BookingType {
  onDemand,
  scheduled;

  static BookingType fromWire(String value) => switch (value) {
    'on_demand' => BookingType.onDemand,
    'scheduled' => BookingType.scheduled,
    _ => throw FormatException('Unknown booking type "$value".'),
  };

  String get wireValue => switch (this) {
    BookingType.onDemand => 'on_demand',
    BookingType.scheduled => 'scheduled',
  };
}

BookingStatus readBookingStatus(Map<String, dynamic> json, String key) =>
    BookingStatus.fromWire(readString(json, key));

BookingType readBookingType(Map<String, dynamic> json, String key) =>
    BookingType.fromWire(readString(json, key));
