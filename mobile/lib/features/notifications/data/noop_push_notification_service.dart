import 'package:mobile/features/notifications/domain/push_notification_service.dart';

/// Used wherever Firebase has not been configured for this build (see
/// `push_notification_providers.dart`). Declines permission and produces no
/// token, rather than the app crashing or pretending push works.
class NoopPushNotificationService implements PushNotificationService {
  const NoopPushNotificationService();

  @override
  Future<bool> requestPermission() async => false;

  @override
  Future<String?> getToken() async => null;

  @override
  Stream<String> get onTokenRefresh => const Stream.empty();

  @override
  Stream<RemoteMessagePayload> get onForegroundMessage => const Stream.empty();

  @override
  Stream<RemoteMessagePayload> get onMessageOpenedApp => const Stream.empty();

  @override
  Future<void> deleteToken() async {}
}
