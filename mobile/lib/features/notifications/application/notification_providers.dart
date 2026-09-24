import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/network_providers.dart';
import 'package:mobile/core/utils/provider_retry.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';
import 'package:mobile/features/notifications/data/firebase_push_notification_service.dart';
import 'package:mobile/features/notifications/data/noop_push_notification_service.dart';
import 'package:mobile/features/notifications/data/notification_api_repository.dart';
import 'package:mobile/features/notifications/domain/device_platform.dart';
import 'package:mobile/features/notifications/domain/notification_repository.dart';
import 'package:mobile/features/notifications/domain/push_notification_service.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>(
  (ref) => NotificationApiRepository(ref.watch(apiClientProvider)),
);

/// Whether `Firebase.initializeApp` succeeded for this build (see
/// `main.dart`). Defaults to false, so this provider's own default — and
/// every test, which never overrides it — gets the safe
/// [NoopPushNotificationService] automatically: permission is declined and no
/// token is ever produced, rather than calling into an uninitialized Firebase
/// SDK. Real device push therefore requires both a Firebase project
/// configured for the build (`google-services.json` /
/// `GoogleService-Info.plist`, not present in every environment this app is
/// built in) AND this flag being true.
final firebaseAvailableProvider = Provider<bool>((ref) => false);

final pushNotificationServiceProvider = Provider<PushNotificationService>((
  ref,
) {
  if (!ref.watch(firebaseAvailableProvider)) {
    return const NoopPushNotificationService();
  }
  return FirebaseMessagingPushNotificationService(FirebaseMessaging.instance);
});

DevicePlatform _currentPlatform() => defaultTargetPlatform == TargetPlatform.iOS
    ? DevicePlatform.ios
    : DevicePlatform.android;

/// Registers this device's push token for as long as someone is signed in,
/// re-registering on refresh, and removes it again on sign-out — the same
/// lifecycle `trackingSocketProvider` gives the location socket.
///
/// Never prompts for permission itself: `build` only picks up a token that
/// was already granted in an earlier session (harmless to check — it prompts
/// nothing new). The first-time OS permission prompt is only ever triggered
/// by an explicit tap on [NotificationPermissionBanner], via
/// [requestPermissionAndRegister] — see that widget's doc comment for why a
/// silent, unexplained system prompt is avoided.
///
/// The current value is the device's token, or null while push is not (yet)
/// enabled, so the banner can watch this directly to decide whether to show.
class DeviceTokenController extends AsyncNotifier<String?> {
  @override
  Future<String?> build() async {
    if (ref.watch(authStatusProvider) != AuthStatus.authenticated) return null;

    final push = ref.watch(pushNotificationServiceProvider);
    final repository = ref.watch(notificationRepositoryProvider);

    String? currentToken = await push.getToken();
    if (currentToken != null) {
      await repository.registerToken(currentToken, _currentPlatform());
    }

    final subscription = push.onTokenRefresh.listen((token) {
      currentToken = token;
      state = AsyncData(token);
      unawaited(repository.registerToken(token, _currentPlatform()));
    });

    ref.onDispose(() {
      unawaited(subscription.cancel());
      final token = currentToken;
      if (token != null) unawaited(repository.removeToken(token));
    });
    return currentToken;
  }

  /// Requests OS permission and, if granted, fetches and registers a token.
  /// Returns whether push ended up enabled.
  Future<bool> requestPermissionAndRegister() async {
    final push = ref.read(pushNotificationServiceProvider);
    if (!await push.requestPermission()) return false;

    final token = await push.getToken();
    if (token == null) return false;
    await ref
        .read(notificationRepositoryProvider)
        .registerToken(token, _currentPlatform());
    state = AsyncData(token);
    return true;
  }
}

final deviceTokenControllerProvider =
    AsyncNotifierProvider.autoDispose<DeviceTokenController, String?>(
      DeviceTokenController.new,
      retry: noAutomaticRetry,
    );

/// Whether the permission explainer has been dismissed ("Not now") this app
/// session. Resets on restart, so a still-undecided person is asked again
/// next time rather than never — but never twice in the same session.
class NotificationPermissionDismissed extends Notifier<bool> {
  @override
  bool build() => false;

  void dismiss() => state = true;
}

final notificationPermissionDismissedProvider =
    NotifierProvider<NotificationPermissionDismissed, bool>(
      NotificationPermissionDismissed.new,
    );

/// The signed-in user's notification feed: the same durable record `Payment`
/// and `Booking` follow (see `AppNotification`'s doc comment) — never only
/// the ephemeral pushes handled by `PushMessageListener`.
class NotificationFeedController extends AsyncNotifier<NotificationFeed> {
  @override
  Future<NotificationFeed> build() {
    ref.watch(authStatusProvider);
    return ref.watch(notificationRepositoryProvider).listNotifications();
  }

  Future<void> markRead(String id) async {
    await ref.read(notificationRepositoryProvider).markRead(id);
    ref.invalidateSelf();
    await future;
  }

  Future<void> markAllRead() async {
    await ref.read(notificationRepositoryProvider).markAllRead();
    ref.invalidateSelf();
    await future;
  }
}

final notificationFeedProvider =
    AsyncNotifierProvider.autoDispose<
      NotificationFeedController,
      NotificationFeed
    >(NotificationFeedController.new, retry: noAutomaticRetry);

/// 0 whenever the feed has not loaded yet — the badge should never show a
/// stale or guessed count.
final unreadNotificationCountProvider = Provider.autoDispose<int>(
  (ref) => ref.watch(notificationFeedProvider).value?.unreadCount ?? 0,
);
