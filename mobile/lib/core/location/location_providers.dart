import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/location/geolocator_location_service.dart';
import 'package:mobile/core/location/location_service.dart';

final locationServiceProvider = Provider<LocationService>(
  (ref) => GeolocatorLocationService(),
);
