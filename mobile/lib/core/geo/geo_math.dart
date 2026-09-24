import 'dart:math' as math;

const _earthRadiusKm = 6371.0;

/// Straight-line ("as the crow flies") distance between two points, in km.
/// Not a road distance: there is no routing engine behind this, only this
/// formula, matching how the backend ranks providers in Sprint 6.
double distanceKm({
  required double fromLatitude,
  required double fromLongitude,
  required double toLatitude,
  required double toLongitude,
}) {
  double toRad(double deg) => deg * math.pi / 180;
  final dLat = toRad(toLatitude - fromLatitude);
  final dLon = toRad(toLongitude - fromLongitude);
  final lat1 = toRad(fromLatitude);
  final lat2 = toRad(toLatitude);
  final h =
      math.pow(math.sin(dLat / 2), 2) +
      math.cos(lat1) * math.cos(lat2) * math.pow(math.sin(dLon / 2), 2);
  return _earthRadiusKm * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
}

/// A rough, clearly-labelled-as-approximate arrival estimate: straight-line
/// distance divided by an assumed average speed. There is no traffic or road
/// network behind this — it exists only to give a customer a sense of scale
/// ("a few minutes" vs "a while"), not a promise.
Duration roughEta(double distanceKm, {double assumedSpeedKmh = 25}) {
  if (distanceKm <= 0) return Duration.zero;
  final hours = distanceKm / assumedSpeedKmh;
  return Duration(seconds: (hours * 3600).round());
}
