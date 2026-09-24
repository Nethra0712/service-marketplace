import 'package:mobile/core/location/location_reading.dart';

/// Where the realtime connection currently stands. Surfaced so the UI can
/// show "connecting…" / "live" / "reconnecting…" instead of silently going
/// stale.
enum TrackingConnectionState { disconnected, connecting, connected }

/// One location update as delivered over the realtime channel, whoever sent
/// it and whenever it happened.
class TrackedLocation {
  const TrackedLocation({
    required this.latitude,
    required this.longitude,
    required this.at,
    this.headingDegrees,
    this.speedMetersPerSecond,
    this.accuracyMeters,
  });

  final double latitude;
  final double longitude;
  final DateTime at;
  final double? headingDegrees;
  final double? speedMetersPerSecond;
  final double? accuracyMeters;
}

enum BookingRoomRole { customer, provider }

/// What joining a booking's room told us.
class BookingRoomInfo {
  const BookingRoomInfo({required this.role, required this.lastLocation});

  final BookingRoomRole role;

  /// The provider's most recently known location, if the room already had
  /// one cached when we joined.
  final TrackedLocation? lastLocation;
}

/// Thrown when the server refuses a room join or a location update. `code`
/// is the same machine-readable string the server sent (`NOT_FOUND`,
/// `NOT_TRACKABLE`, `RATE_LIMITED`, `VALIDATION_ERROR`).
class TrackingException implements Exception {
  const TrackingException(this.code);

  final String code;

  @override
  String toString() => 'TrackingException($code)';
}

/// The realtime channel used for live provider location. One instance covers
/// the whole signed-in session; a screen joins/leaves the specific booking
/// rooms it cares about rather than owning a connection of its own.
///
/// Deliberately narrow: this is not a general-purpose Socket.IO wrapper, only
/// what location tracking needs, so the transport (currently `socket_io_client`)
/// stays swappable behind it.
abstract interface class TrackingSocket {
  Stream<TrackingConnectionState> get connectionState;

  /// Location updates for whichever booking rooms are currently joined.
  Stream<({String bookingId, TrackedLocation location})> get locationUpdates;

  /// Joins a booking's room. Throws [TrackingException] if the server
  /// refuses (not authorized, or the booking does not exist — indistinguishable
  /// on purpose).
  Future<BookingRoomInfo> joinBooking(String bookingId);

  Future<void> leaveBooking(String bookingId);

  /// Provider only: publishes one reading for a booking currently joined.
  /// Throws [TrackingException] if refused (not the assigned provider, the
  /// booking is no longer trackable, or this arrived too soon after the last
  /// one).
  Future<void> sendLocationUpdate(String bookingId, LocationReading reading);

  /// Releases the underlying connection. Call once, when the session ends.
  void dispose();
}
