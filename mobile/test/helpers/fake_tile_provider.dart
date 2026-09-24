import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:flutter_map/flutter_map.dart';

const _transparentPixelPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

final Uint8List _transparentPixelPng = base64Decode(_transparentPixelPngBase64);

/// A [TileProvider] that never touches the network: every tile is a 1x1
/// transparent pixel served from memory. Wired into every widget test via
/// `AuthHarness`'s base overrides (`appMapTileProviderOverrideProvider`), so
/// pumping a screen that renders `AppMap` never makes a real HTTP request.
class FakeTileProvider extends TileProvider {
  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) =>
      MemoryImage(_transparentPixelPng);
}
