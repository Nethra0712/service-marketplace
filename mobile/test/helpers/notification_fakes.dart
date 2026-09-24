import 'dart:async';

import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/notifications/domain/device_platform.dart';
import 'package:mobile/features/notifications/domain/notification.dart';
import 'package:mobile/features/notifications/domain/notification_kind.dart';
import 'package:mobile/features/notifications/domain/notification_repository.dart';
import 'package:mobile/features/notifications/domain/push_notification_service.dart';

/// A notification fixture, built the way a real server response would look.
AppNotification notificationOf({
  String id = 'notification-1',
  NotificationKind kind = NotificationKind.bookingAccepted,
  String title = 'Booking accepted',
  String body = 'A provider has accepted your booking.',
  String? bookingId = 'b1',
  String? paymentId,
  String? payoutId,
  DateTime? readAt,
}) => AppNotification(
  id: id,
  kind: kind,
  title: title,
  body: body,
  bookingId: bookingId,
  paymentId: paymentId,
  payoutId: payoutId,
  readAt: readAt,
  createdAt: DateTime.utc(2026, 1, 1, 11),
);

/// An in-memory [NotificationRepository]. Tests seed [items] and record what
/// the app asked it to do, the same way `FakePaymentRepository` works.
class FakeNotificationRepository implements NotificationRepository {
  List<AppNotification> items = [];
  bool pushEnabled = true;
  final registeredTokens = <String, DevicePlatform>{};
  final removedTokens = <String>[];
  final readIds = <String>[];
  bool markedAllRead = false;

  final Map<String, AppException> failures = {};
  void _maybeFail(String method) {
    final failure = failures.remove(method);
    if (failure != null) throw failure;
  }

  int get unreadCount => items.where((n) => n.isUnread).length;

  @override
  Future<void> registerToken(String token, DevicePlatform platform) async {
    _maybeFail('registerToken');
    registeredTokens[token] = platform;
  }

  @override
  Future<void> removeToken(String token) async {
    _maybeFail('removeToken');
    registeredTokens.remove(token);
    removedTokens.add(token);
  }

  @override
  Future<bool> getPushEnabled() async {
    _maybeFail('getPushEnabled');
    return pushEnabled;
  }

  @override
  Future<void> setPushEnabled(bool enabled) async {
    _maybeFail('setPushEnabled');
    pushEnabled = enabled;
  }

  @override
  Future<NotificationFeed> listNotifications() async {
    _maybeFail('listNotifications');
    return NotificationFeed(items: items, unreadCount: unreadCount);
  }

  @override
  Future<void> markRead(String id) async {
    _maybeFail('markRead');
    readIds.add(id);
    items = [
      for (final item in items)
        if (item.id == id)
          AppNotification(
            id: item.id,
            kind: item.kind,
            title: item.title,
            body: item.body,
            bookingId: item.bookingId,
            paymentId: item.paymentId,
            payoutId: item.payoutId,
            readAt: DateTime.utc(2026, 1, 1, 12),
            createdAt: item.createdAt,
          )
        else
          item,
    ];
  }

  @override
  Future<void> markAllRead() async {
    _maybeFail('markAllRead');
    markedAllRead = true;
    items = [
      for (final item in items)
        AppNotification(
          id: item.id,
          kind: item.kind,
          title: item.title,
          body: item.body,
          bookingId: item.bookingId,
          paymentId: item.paymentId,
          payoutId: item.payoutId,
          readAt: item.readAt ?? DateTime.utc(2026, 1, 1, 12),
          createdAt: item.createdAt,
        ),
    ];
  }
}

/// A controllable [PushNotificationService] for tests: permission and token
/// are scripted rather than backed by any real platform channel.
class FakePushNotificationService implements PushNotificationService {
  bool permissionGranted = true;
  String? token = 'fake-device-token';
  final tokenRefreshController = StreamController<String>.broadcast();
  final foregroundController =
      StreamController<RemoteMessagePayload>.broadcast();
  final openedController = StreamController<RemoteMessagePayload>.broadcast();
  String? deletedToken;

  @override
  Future<bool> requestPermission() async => permissionGranted;

  // Deliberately NOT gated on [permissionGranted]: it independently models
  // "is a token currently obtainable" (a token from an earlier session, or
  // one a test sets right before simulating a grant), the same way the real
  // OS does not require re-requesting permission on every launch.
  @override
  Future<String?> getToken() async => token;

  @override
  Stream<String> get onTokenRefresh => tokenRefreshController.stream;

  @override
  Stream<RemoteMessagePayload> get onForegroundMessage =>
      foregroundController.stream;

  @override
  Stream<RemoteMessagePayload> get onMessageOpenedApp =>
      openedController.stream;

  @override
  Future<void> deleteToken() async {
    deletedToken = token;
    token = null;
  }
}
