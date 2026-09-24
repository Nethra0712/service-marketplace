import 'package:mobile/core/location/location_permission_status.dart';
import 'package:mobile/core/location/location_reading.dart';

/// Device location, behind an interface so the concrete plugin (geolocator)
/// never leaks into screens or tests. Every method that touches the OS is
/// async and can be faked; nothing here ever assumes permission is granted.
abstract interface class LocationService {
  /// The current status, without prompting. Cheap enough to call often.
  Future<LocationPermissionStatus> checkPermission();

  /// Prompts the OS permission dialog if not yet decided, and returns the
  /// resulting status. A no-op (just returns the current status) once the
  /// person has already answered, `deniedForever`, or the OS location
  /// service is off.
  Future<LocationPermissionStatus> requestPermission();

  /// One current fix, or null if permission is not granted or a fix could
  /// not be obtained. Requests permission first if it has not been decided.
  Future<LocationReading?> getCurrentLocation();

  /// A stream of fixes while permission is granted. Filtered so a reading is
  /// only emitted after the device has moved roughly [distanceFilterMeters],
  /// not on a fixed timer: that is what keeps this from transmitting
  /// continuously when the provider has not actually gone anywhere.
  Stream<LocationReading> watchPosition({required int distanceFilterMeters});

  /// Opens this app's OS settings page, for a `deniedForever` permission.
  Future<void> openAppSettings();

  /// Opens the OS location (GPS) settings page, for a disabled location service.
  Future<void> openLocationSettings();
}
