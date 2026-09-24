import 'package:url_launcher/url_launcher.dart' as launcher;

/// Opens a URL in whatever app the OS hands it to (a maps app, a browser).
/// Behind an interface so a "navigate" button can be tested without actually
/// leaving the app.
abstract interface class UrlLauncherService {
  /// Returns whether something was actually opened.
  Future<bool> launch(Uri url);
}

class ExternalUrlLauncherService implements UrlLauncherService {
  @override
  Future<bool> launch(Uri url) =>
      launcher.launchUrl(url, mode: launcher.LaunchMode.externalApplication);
}
