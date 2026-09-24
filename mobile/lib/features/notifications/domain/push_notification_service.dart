import 'package:mobile/features/notifications/domain/notification_kind.dart';

/// A push message as it arrives on the device — foreground, or tapped open
/// from the background/terminated state. Deliberately smaller than the full
/// `AppNotification`: this is what the OS handed the app, not what the
/// server's feed holds (that's `NotificationRepository.listNotifications`).
class RemoteMessagePayload {
  const RemoteMessagePayload({
    required this.title,
    required this.body,
    required this.data,
  });

  final String? title;
  final String? body;
  final Map<String, String> data;

  /// Set on every push this app sends — see `notifications.service.ts`'s
  /// `notify`. Null for a push this app did not originate.
  NotificationKind? get kind {
    final wire = data['kind'];
    return wire == null ? null : NotificationKind.fromWire(wire);
  }

  /// Present when [kind] is booking-related. Where a tap should deep-link to.
  String? get bookingId => data['bookingId'];
}

/// The only thing the rest of the app knows about push delivery.
///
/// A real backend (Firebase Cloud Messaging, via
/// [FirebaseMessagingPushNotificationService]) is added by implementing this
/// interface; nothing else changes. [NoopPushNotificationService] is the
/// fallback used wherever Firebase has not been configured (see
/// `push_notification_providers.dart`'s doc comment) — permission is simply
/// declined and no token is ever produced, rather than the app crashing.
abstract interface class PushNotificationService {
  /// Prompts the user (iOS always; Android 13+ only — earlier Android
  /// versions have no runtime prompt and are always allowed). Returns
  /// whether push is now allowed.
  Future<bool> requestPermission();

  /// This device's current token, or null if push is unavailable/undetermined.
  Future<String?> getToken();

  /// Fires when the OS issues a new token, invalidating the previous one.
  Stream<String> get onTokenRefresh;

  /// A push that arrived while the app was in the foreground. The OS does not
  /// show these on its own; the app decides how (see `NotificationListener`).
  Stream<RemoteMessagePayload> get onForegroundMessage;

  /// The user tapped a push to open (or resume) the app from the
  /// background/terminated state.
  Stream<RemoteMessagePayload> get onMessageOpenedApp;

  /// Invalidates this device's token, e.g. on sign-out.
  Future<void> deleteToken();
}
