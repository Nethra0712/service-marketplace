import 'dart:async';

import 'package:mobile/core/location/location_permission_status.dart';
import 'package:mobile/core/location/location_reading.dart';
import 'package:mobile/core/location/location_service.dart';

/// An in-memory [LocationService]. Tests set [status]/[currentLocation]
/// directly and call [emit] to push a reading onto whatever is watching
/// [watchPosition].
class FakeLocationService implements LocationService {
  LocationPermissionStatus status = LocationPermissionStatus.granted;
  LocationReading? currentLocation;

  final _positionController = StreamController<LocationReading>.broadcast();

  var checkPermissionCalls = 0;
  var requestPermissionCalls = 0;
  var openAppSettingsCalls = 0;
  var openLocationSettingsCalls = 0;
  final distanceFiltersRequested = <int>[];

  @override
  Future<LocationPermissionStatus> checkPermission() async {
    checkPermissionCalls += 1;
    return status;
  }

  @override
  Future<LocationPermissionStatus> requestPermission() async {
    requestPermissionCalls += 1;
    return status;
  }

  @override
  Future<LocationReading?> getCurrentLocation() async {
    if (!status.isGranted) return null;
    return currentLocation;
  }

  @override
  Stream<LocationReading> watchPosition({required int distanceFilterMeters}) {
    distanceFiltersRequested.add(distanceFilterMeters);
    return _positionController.stream;
  }

  /// Pushes a reading to whoever is currently watching [watchPosition].
  void emit(LocationReading reading) => _positionController.add(reading);

  @override
  Future<void> openAppSettings() async {
    openAppSettingsCalls += 1;
  }

  @override
  Future<void> openLocationSettings() async {
    openLocationSettingsCalls += 1;
  }

  void dispose() => unawaited(_positionController.close());
}
