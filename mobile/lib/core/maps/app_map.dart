import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart' as fm;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart' as ll;
import 'package:mobile/core/maps/map_point.dart';

/// Overrides the tile source used by [AppMap]. Production never sets this
/// (the real OpenStreetMap tiles load); widget tests override it with an
/// offline provider so pumping a screen with a map never makes a real network
/// request.
final appMapTileProviderOverrideProvider = Provider<fm.TileProvider?>(
  (ref) => null,
);

/// The app's only map widget. Screens depend on this and the plain
/// [MapPoint]/[MapMarkerSpec] types, never on `package:flutter_map` directly
/// — that is what lets the map engine behind it be replaced later (a
/// different tile source, or a different package altogether) without
/// touching a screen.
///
/// Currently backed by `flutter_map` with OpenStreetMap tiles: no API key,
/// so it renders in this environment with zero credential setup.
class AppMap extends ConsumerWidget {
  const AppMap({
    required this.markers,
    this.polylinePoints,
    this.initialCenter,
    this.initialZoom = 14,
    this.interactive = true,
    super.key,
  });

  final List<MapMarkerSpec> markers;

  /// Drawn as a simple line, not a routed path: there is no routing engine
  /// behind this map, only the points given.
  final List<MapPoint>? polylinePoints;
  final MapPoint? initialCenter;
  final double initialZoom;
  final bool interactive;

  static ll.LatLng _toLatLng(MapPoint p) => ll.LatLng(p.latitude, p.longitude);

  static const _fallbackCenter = MapPoint(
    latitude: 6.9271,
    longitude: 79.8612,
  ); // Colombo

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tileProvider = ref.watch(appMapTileProviderOverrideProvider);
    final center =
        initialCenter ??
        (markers.isNotEmpty ? markers.first.point : _fallbackCenter);
    final polyline = polylinePoints;

    return fm.FlutterMap(
      options: fm.MapOptions(
        initialCenter: _toLatLng(center),
        initialZoom: initialZoom,
        interactionOptions: fm.InteractionOptions(
          flags: interactive ? fm.InteractiveFlag.all : fm.InteractiveFlag.none,
        ),
      ),
      children: [
        fm.TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'lk.servicemarketplace.mobile',
          tileProvider: tileProvider ?? fm.NetworkTileProvider(),
        ),
        if (polyline != null && polyline.length >= 2)
          fm.PolylineLayer(
            polylines: [
              fm.Polyline(
                points: polyline.map(_toLatLng).toList(growable: false),
                strokeWidth: 4,
                color: Colors.blueAccent,
              ),
            ],
          ),
        fm.MarkerLayer(
          markers: [
            for (final marker in markers)
              fm.Marker(
                key: Key('map_marker_${marker.id}'),
                point: _toLatLng(marker.point),
                width: 40,
                height: 40,
                child: _MarkerIcon(kind: marker.kind),
              ),
          ],
        ),
      ],
    );
  }
}

class _MarkerIcon extends StatelessWidget {
  const _MarkerIcon({required this.kind});

  final MapMarkerKind kind;

  @override
  Widget build(BuildContext context) => Icon(
    kind == MapMarkerKind.provider
        ? Icons.local_shipping
        : Icons.person_pin_circle,
    color: kind == MapMarkerKind.provider ? Colors.deepOrange : Colors.blue,
    size: 36,
  );
}
