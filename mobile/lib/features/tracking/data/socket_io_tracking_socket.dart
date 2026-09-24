import 'dart:async';

import 'package:mobile/core/location/location_reading.dart';
import 'package:mobile/core/network/access_token_interceptor.dart';
import 'package:mobile/features/tracking/domain/tracking_socket.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

BookingRoomRole _roleOf(String value) => switch (value) {
  'provider' => BookingRoomRole.provider,
  _ => BookingRoomRole.customer,
};

TrackedLocation _locationOf(Map<String, dynamic> json) => TrackedLocation(
  latitude: (json['latitude'] as num).toDouble(),
  longitude: (json['longitude'] as num).toDouble(),
  at: DateTime.parse(json['at'] as String),
  headingDegrees: (json['heading'] as num?)?.toDouble(),
  speedMetersPerSecond: (json['speed'] as num?)?.toDouble(),
  accuracyMeters: (json['accuracyMeters'] as num?)?.toDouble(),
);

Map<String, dynamic> _readingToWire(
  String bookingId,
  LocationReading reading,
) => {
  'bookingId': bookingId,
  'latitude': reading.latitude,
  'longitude': reading.longitude,
  if (reading.headingDegrees != null) 'heading': reading.headingDegrees,
  if (reading.speedMetersPerSecond != null)
    'speed': reading.speedMetersPerSecond,
  if (reading.accuracyMeters != null) 'accuracyMeters': reading.accuracyMeters,
};

/// [TrackingSocket] backed by `socket_io_client`. Connects lazily on first
/// use and reconnects on its own for ordinary network hiccups; the access
/// token is re-read fresh on every (re)connect attempt via [readAccessToken],
/// so a token refreshed since the last connection is picked up automatically.
class SocketIoTrackingSocket implements TrackingSocket {
  SocketIoTrackingSocket({
    required this.baseUrl,
    required this.readAccessToken,
  });

  final String baseUrl;
  final AccessTokenReader readAccessToken;

  io.Socket? _socket;
  final _connectionStateController =
      StreamController<TrackingConnectionState>.broadcast();
  final _locationController =
      StreamController<
        ({String bookingId, TrackedLocation location})
      >.broadcast();

  @override
  Stream<TrackingConnectionState> get connectionState =>
      _connectionStateController.stream;

  @override
  Stream<({String bookingId, TrackedLocation location})> get locationUpdates =>
      _locationController.stream;

  io.Socket _ensureConnected() {
    final existing = _socket;
    if (existing != null) return existing;

    final socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuthFn((callback) {
            readAccessToken().then((token) => callback({'token': token ?? ''}));
          })
          .enableReconnection()
          .setReconnectionDelay(500)
          .setReconnectionDelayMax(5000)
          .build(),
    );
    socket.onConnect(
      (_) => _connectionStateController.add(TrackingConnectionState.connected),
    );
    socket.onDisconnect(
      (_) =>
          _connectionStateController.add(TrackingConnectionState.disconnected),
    );
    socket.onConnectError(
      (_) =>
          _connectionStateController.add(TrackingConnectionState.disconnected),
    );
    socket.onReconnectAttempt(
      (_) => _connectionStateController.add(TrackingConnectionState.connecting),
    );
    socket.on('location:update', (data) {
      if (data is! Map) return;
      final json = Map<String, dynamic>.from(data);
      final bookingId = json['bookingId'] as String?;
      if (bookingId == null) return;
      _locationController.add((
        bookingId: bookingId,
        location: _locationOf(json),
      ));
    });

    _connectionStateController.add(TrackingConnectionState.connecting);
    socket.connect();
    _socket = socket;
    return socket;
  }

  Future<Map<String, dynamic>> _emit(
    String event,
    Map<String, dynamic> payload,
  ) async {
    final socket = _ensureConnected();
    final ack = await socket.emitWithAckAsync(event, payload);
    return Map<String, dynamic>.from(ack as Map);
  }

  @override
  Future<BookingRoomInfo> joinBooking(String bookingId) async {
    final ack = await _emit('booking:join', {'bookingId': bookingId});
    if (ack['ok'] != true) {
      throw TrackingException(ack['error'] as String? ?? 'UNKNOWN');
    }
    final lastLocationJson = ack['lastLocation'];
    return BookingRoomInfo(
      role: _roleOf(ack['role'] as String? ?? 'customer'),
      lastLocation: lastLocationJson is Map
          ? _locationOf(Map<String, dynamic>.from(lastLocationJson))
          : null,
    );
  }

  @override
  Future<void> leaveBooking(String bookingId) async {
    await _emit('booking:leave', {'bookingId': bookingId});
  }

  @override
  Future<void> sendLocationUpdate(
    String bookingId,
    LocationReading reading,
  ) async {
    final ack = await _emit(
      'location:update',
      _readingToWire(bookingId, reading),
    );
    if (ack['ok'] != true) {
      throw TrackingException(ack['error'] as String? ?? 'UNKNOWN');
    }
  }

  @override
  void dispose() {
    _socket?.dispose();
    _socket = null;
    unawaited(_connectionStateController.close());
    unawaited(_locationController.close());
  }
}
