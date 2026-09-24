import 'package:mobile/core/navigation/url_launcher_service.dart';

/// Records every URL the app under test asked to open, instead of actually
/// leaving the app.
class FakeUrlLauncherService implements UrlLauncherService {
  final launchedUrls = <Uri>[];
  bool result = true;

  @override
  Future<bool> launch(Uri url) async {
    launchedUrls.add(url);
    return result;
  }
}
