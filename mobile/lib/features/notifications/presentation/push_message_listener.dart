import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/router/app_router.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/features/notifications/application/notification_providers.dart';
import 'package:mobile/features/notifications/domain/push_notification_service.dart';

/// Foreground and background/deep-link push handling for the whole app.
///
/// The OS shows a system notification for a push on its own only while the
/// app is backgrounded/closed; a push that arrives in the FOREGROUND is
/// silent by default, so this is what makes the app visibly react to one
/// (a snackbar, and the notification feed/badge refreshing immediately
/// rather than waiting for the next pull-to-refresh). Tapping a push to open
/// the app (background or terminated) is handled the same way through
/// `onMessageOpenedApp`, deep-linking straight to the booking it's about.
///
/// Mounted once, above the router, so it keeps working no matter which
/// screen is on top — see `app.dart`.
class PushMessageListener extends ConsumerStatefulWidget {
  const PushMessageListener({
    required this.child,
    required this.messengerKey,
    super.key,
  });

  final Widget child;
  final GlobalKey<ScaffoldMessengerState> messengerKey;

  @override
  ConsumerState<PushMessageListener> createState() =>
      _PushMessageListenerState();
}

class _PushMessageListenerState extends ConsumerState<PushMessageListener> {
  StreamSubscription<RemoteMessagePayload>? _foregroundSubscription;
  StreamSubscription<RemoteMessagePayload>? _openedSubscription;

  @override
  void initState() {
    super.initState();
    final push = ref.read(pushNotificationServiceProvider);
    _foregroundSubscription = push.onForegroundMessage.listen(_onForeground);
    _openedSubscription = push.onMessageOpenedApp.listen(_onOpened);
  }

  void _onForeground(RemoteMessagePayload message) {
    ref.invalidate(notificationFeedProvider);
    final title = message.title;
    if (title == null) return;
    widget.messengerKey.currentState?.showSnackBar(
      SnackBar(content: Text(title)),
    );
  }

  void _onOpened(RemoteMessagePayload message) {
    ref.invalidate(notificationFeedProvider);
    final bookingId = message.bookingId;
    final router = ref.read(routerProvider);
    if ((message.kind?.isBookingRelated ?? true) && bookingId != null) {
      router.push(AppRoutes.bookingDetailLocation(bookingId));
    } else {
      router.push(AppRoutes.notifications.path);
    }
  }

  @override
  void dispose() {
    unawaited(_foregroundSubscription?.cancel());
    unawaited(_openedSubscription?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Keeps device-token registration running for the whole signed-in
    // session, not just while a screen that happens to read it is open.
    ref.watch(deviceTokenControllerProvider);
    return widget.child;
  }
}
