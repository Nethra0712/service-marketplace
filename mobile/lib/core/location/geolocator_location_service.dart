import 'package:geolocator/geolocator.dart' as geo;
import 'package:mobile/core/location/location_permission_status.dart';
import 'package:mobile/core/location/location_reading.dart';
import 'package:mobile/core/location/location_service.dart';

LocationPermissionStatus _statusOf(geo.LocationPermission permission) =>
    switch (permission) {
      geo.LocationPermission.always ||
      geo.LocationPermission.whileInUse => LocationPermissionStatus.granted,
      geo.LocationPermission.denied ||
      geo.LocationPermission.unableToDetermine =>
        LocationPermissionStatus.denied,
      geo.LocationPermission.deniedForever =>
        LocationPermissionStatus.deniedForever,
    };

LocationReading _readingOf(geo.Position position) => LocationReading(
  latitude: position.latitude,
  longitude: position.longitude,
  headingDegrees: position.heading.isNaN ? null : position.heading,
  speedMetersPerSecond: position.speed.isNaN ? null : position.speed,
  accuracyMeters: position.accuracy.isNaN ? null : position.accuracy,
);

/// [LocationService] backed by the `geolocator` plugin.
class GeolocatorLocationService implements LocationService {
  @override
  Future<LocationPermissionStatus> checkPermission() async {
    if (!await geo.Geolocator.isLocationServiceEnabled()) {
      return LocationPermissionStatus.serviceDisabled;
    }
    return _statusOf(await geo.Geolocator.checkPermission());
  }

  @override
  Future<LocationPermissionStatus> requestPermission() async {
    if (!await geo.Geolocator.isLocationServiceEnabled()) {
      return LocationPermissionStatus.serviceDisabled;
    }
    var permission = await geo.Geolocator.checkPermission();
    if (permission == geo.LocationPermission.denied) {
      permission = await geo.Geolocator.requestPermission();
    }
    return _statusOf(permission);
  }

  @override
  Future<LocationReading?> getCurrentLocation() async {
    if (!(await requestPermission()).isGranted) return null;
    final position = await geo.Geolocator.getCurrentPosition(
      locationSettings: const geo.LocationSettings(
        accuracy: geo.LocationAccuracy.high,
      ),
    );
    return _readingOf(position);
  }

  @override
  Stream<LocationReading> watchPosition({required int distanceFilterMeters}) {
    return geo.Geolocator.getPositionStream(
      locationSettings: geo.LocationSettings(
        accuracy: geo.LocationAccuracy.high,
        distanceFilter: distanceFilterMeters,
      ),
    ).map(_readingOf);
  }

  @override
  Future<void> openAppSettings() async {
    await geo.Geolocator.openAppSettings();
  }

  @override
  Future<void> openLocationSettings() async {
    await geo.Geolocator.openLocationSettings();
  }
}
