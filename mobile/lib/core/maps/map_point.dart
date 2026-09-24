/// A plain latitude/longitude pair. The only coordinate type screens deal
/// in; nothing outside `lib/core/maps` should import a map engine's own point
/// type (currently `latlong2`'s `LatLng`).
class MapPoint {
  const MapPoint({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;
}

/// What a marker on [AppMap] represents. The map draws each kind differently
/// (colour/icon) so a glance tells you which is which.
enum MapMarkerKind { customer, provider }

class MapMarkerSpec {
  const MapMarkerSpec({
    required this.id,
    required this.point,
    required this.kind,
  });

  /// Unique within one map; also becomes part of the marker's widget key.
  final String id;
  final MapPoint point;
  final MapMarkerKind kind;
}
