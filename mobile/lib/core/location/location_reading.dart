/// One raw position reading from the device, however it arrived (a one-shot
/// fix or one event from a stream).
class LocationReading {
  const LocationReading({
    required this.latitude,
    required this.longitude,
    this.headingDegrees,
    this.speedMetersPerSecond,
    this.accuracyMeters,
  });

  final double latitude;
  final double longitude;

  /// Compass heading in degrees (0-360), if the device reports one.
  final double? headingDegrees;
  final double? speedMetersPerSecond;

  /// The device's own accuracy estimate for this reading, in metres.
  final double? accuracyMeters;
}
