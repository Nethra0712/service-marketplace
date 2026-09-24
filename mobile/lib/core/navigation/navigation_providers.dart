import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/navigation/url_launcher_service.dart';

final urlLauncherServiceProvider = Provider<UrlLauncherService>(
  (ref) => ExternalUrlLauncherService(),
);

/// A universal maps link: opens the OS's own maps app if one is installed,
/// or a browser otherwise. Works the same on Android and iOS without any
/// platform-specific intent scheme.
Uri navigationHandoffUrl({
  required double latitude,
  required double longitude,
}) => Uri.https('www.google.com', '/maps/dir/', {
  'api': '1',
  'destination': '$latitude,$longitude',
});
