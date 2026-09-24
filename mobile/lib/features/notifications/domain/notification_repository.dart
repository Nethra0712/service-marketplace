import 'package:mobile/features/notifications/domain/device_platform.dart';
import 'package:mobile/features/notifications/domain/notification.dart';

class NotificationFeed {
  const NotificationFeed({required this.items, required this.unreadCount});

  final List<AppNotification> items;
  final int unreadCount;
}

/// Self-service device tokens, push preferences and the in-app notification
/// feed. There is no client-side notification composition here: every
/// title/body comes back from the server (see `AppNotification`'s doc
/// comment) — this app only registers/removes tokens and reads the feed.
abstract interface class NotificationRepository {
  /// Registers a token (first launch, or after a token refresh — see
  /// `notifications.service.ts`'s doc comment on why a refresh is just a
  /// register + remove of the old token, not a separate operation).
  Future<void> registerToken(String token, DevicePlatform platform);

  Future<void> removeToken(String token);

  Future<bool> getPushEnabled();

  Future<void> setPushEnabled(bool enabled);

  Future<NotificationFeed> listNotifications();

  Future<void> markRead(String id);

  Future<void> markAllRead();
}
