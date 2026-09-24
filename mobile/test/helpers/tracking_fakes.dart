import 'dart:async';

import 'package:mobile/core/location/location_reading.dart';
import 'package:mobile/features/tracking/domain/tracking_socket.dart';

/// An in-memory [TrackingSocket]. Scripts join outcomes per booking id and
/// records everything the app under test asked it to do, the same way
/// `FakeBookingRepository` works for the REST side.
class FakeTrackingSocket implements TrackingSocket {
  final _connectionController =
      StreamController<TrackingConnectionState>.broadcast();
  final _locationController =
      StreamController<
        ({String bookingId, TrackedLocation location})
      >.broadcast();

  /// What `joinBooking` returns for a given id. Missing = the default
  /// (customer role, no cached location) unless [joinFailures] scripts a throw.
  final Map<String, BookingRoomInfo> joinResults = {};
  final Map<String, TrackingException> joinFailures = {};
  TrackingException? sendFailure;

  final joinedBookingIds = <String>[];
  final leftBookingIds = <String>[];
  final sentUpdates = <({String bookingId, LocationReading reading})>[];

  @override
  Stream<TrackingConnectionState> get connectionState =>
      _connectionController.stream;

  @override
  Stream<({String bookingId, TrackedLocation location})> get locationUpdates =>
      _locationController.stream;

  void emitConnectionState(TrackingConnectionState state) =>
      _connectionController.add(state);

  void emitLocation(String bookingId, TrackedLocation location) =>
      _locationController.add((bookingId: bookingId, location: location));

  @override
  Future<BookingRoomInfo> joinBooking(String bookingId) async {
    joinedBookingIds.add(bookingId);
    final failure = joinFailures[bookingId];
    if (failure != null) throw failure;
    return joinResults[bookingId] ??
        const BookingRoomInfo(
          role: BookingRoomRole.customer,
          lastLocation: null,
        );
  }

  @override
  Future<void> leaveBooking(String bookingId) async {
    leftBookingIds.add(bookingId);
  }

  @override
  Future<void> sendLocationUpdate(
    String bookingId,
    LocationReading reading,
  ) async {
    sentUpdates.add((bookingId: bookingId, reading: reading));
    final failure = sendFailure;
    if (failure != null) throw failure;
  }

  @override
  void dispose() {
    unawaited(_connectionController.close());
    unawaited(_locationController.close());
  }
}
