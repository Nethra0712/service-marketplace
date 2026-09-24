import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:mobile/features/notifications/domain/push_notification_service.dart';

RemoteMessagePayload _toPayload(RemoteMessage message) => RemoteMessagePayload(
  title: message.notification?.title,
  body: message.notification?.body,
  data: message.data.map((key, value) => MapEntry(key, value.toString())),
);

/// Real Firebase Cloud Messaging integration. Requires `Firebase.initializeApp`
/// to have already succeeded — see `push_notification_providers.dart`'s doc
/// comment on why that is not guaranteed in every environment this app runs
/// in, and what happens when it has not.
class FirebaseMessagingPushNotificationService
    implements PushNotificationService {
  FirebaseMessagingPushNotificationService(this._messaging);

  final FirebaseMessaging _messaging;

  @override
  Future<bool> requestPermission() async {
    final settings = await _messaging.requestPermission();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<String?> getToken() => _messaging.getToken();

  @override
  Stream<String> get onTokenRefresh => _messaging.onTokenRefresh;

  @override
  Stream<RemoteMessagePayload> get onForegroundMessage =>
      FirebaseMessaging.onMessage.map(_toPayload);

  @override
  Stream<RemoteMessagePayload> get onMessageOpenedApp =>
      FirebaseMessaging.onMessageOpenedApp.map(_toPayload);

  @override
  Future<void> deleteToken() => _messaging.deleteToken();
}
