import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/geo/geo_math.dart';

void main() {
  // Colombo Fort and Kandy, roughly.
  const colombo = (latitude: 6.9344, longitude: 79.8428);
  const kandy = (latitude: 7.2906, longitude: 80.6337);

  group('distanceKm', () {
    test('is zero for the same point', () {
      final km = distanceKm(
        fromLatitude: colombo.latitude,
        fromLongitude: colombo.longitude,
        toLatitude: colombo.latitude,
        toLongitude: colombo.longitude,
      );
      expect(km, closeTo(0, 0.001));
    });

    test('is symmetric', () {
      final forward = distanceKm(
        fromLatitude: colombo.latitude,
        fromLongitude: colombo.longitude,
        toLatitude: kandy.latitude,
        toLongitude: kandy.longitude,
      );
      final backward = distanceKm(
        fromLatitude: kandy.latitude,
        fromLongitude: kandy.longitude,
        toLatitude: colombo.latitude,
        toLongitude: colombo.longitude,
      );
      expect(forward, closeTo(backward, 0.001));
    });

    test('matches the well-known Colombo-Kandy distance, roughly', () {
      final km = distanceKm(
        fromLatitude: colombo.latitude,
        fromLongitude: colombo.longitude,
        toLatitude: kandy.latitude,
        toLongitude: kandy.longitude,
      );
      // Straight-line, not road distance: somewhere around 90-100km.
      expect(km, greaterThan(80));
      expect(km, lessThan(110));
    });

    test('a small offset gives a small, non-zero distance', () {
      final km = distanceKm(
        fromLatitude: colombo.latitude,
        fromLongitude: colombo.longitude,
        toLatitude: colombo.latitude + 0.01,
        toLongitude: colombo.longitude,
      );
      expect(km, greaterThan(0));
      expect(km, lessThan(2));
    });
  });

  group('roughEta', () {
    test('is zero for zero distance', () {
      expect(roughEta(0), Duration.zero);
    });

    test('is proportional to distance at the assumed speed', () {
      // 25 km at the default 25 km/h assumption is exactly one hour.
      expect(roughEta(25), const Duration(hours: 1));
    });

    test('a custom assumed speed changes the estimate', () {
      expect(roughEta(50, assumedSpeedKmh: 50), const Duration(hours: 1));
    });

    test('a negative distance (should never happen) does not go negative', () {
      expect(roughEta(-5), Duration.zero);
    });
  });
}
