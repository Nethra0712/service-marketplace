import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/location/location_permission_status.dart';
import 'package:mobile/core/location/location_providers.dart';
import 'package:mobile/core/network/access_token_interceptor.dart';
import 'package:mobile/core/utils/provider_retry.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/booking/application/booking_providers.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/provider/application/provider_providers.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';
import 'package:mobile/features/tracking/data/socket_io_tracking_socket.dart';
import 'package:mobile/features/tracking/domain/tracking_socket.dart';

/// How far the provider must move before a new reading is even considered for
/// sending (geolocator itself filters the stream at this threshold, so
/// standing still or drifting inside a building never generates a reading
/// at all — never mind transmitting one).
const kProviderTrackingDistanceFilterMeters = 25;

void _watchAccount(Ref ref) => ref.watch(authStatusProvider);

/// One realtime connection for the whole signed-in session. Torn down and
/// rebuilt on sign-out/sign-in, exactly like the booking and provider
/// controllers, so one person's location stream can never leak into the
/// next session on the same device.
final trackingSocketProvider = Provider.autoDispose<TrackingSocket>((ref) {
  _watchAccount(ref);
  final config = ref.watch(appConfigProvider);
  final readToken = ref.watch(accessTokenReaderProvider);
  final socket = SocketIoTrackingSocket(
    baseUrl: config.apiBaseUrl,
    readAccessToken: readToken,
  );
  ref.onDispose(socket.dispose);
  return socket;
});

final trackingConnectionStateProvider =
    StreamProvider.autoDispose<TrackingConnectionState>((ref) {
      return ref.watch(trackingSocketProvider).connectionState;
    });

/// One booking's live location, for whoever is allowed to see it (the
/// server, not this provider, decides that — see `TrackingSocket.joinBooking`).
/// Joins the room on first watch, leaves it when nothing watches it anymore.
class BookingTrackingController extends AsyncNotifier<TrackedLocation?> {
  BookingTrackingController(this.bookingId);

  final String bookingId;

  @override
  Future<TrackedLocation?> build() async {
    _watchAccount(ref);
    final socket = ref.watch(trackingSocketProvider);

    final locationSubscription = socket.locationUpdates
        .where((update) => update.bookingId == bookingId)
        .listen((update) => state = AsyncData(update.location));

    // Room membership lives on the socket.io connection itself, not on the
    // account: a reconnect after a drop is a brand-new connection, so the
    // server has already forgotten this room even though the badge goes
    // straight back to "Live". Without rejoining here, location updates
    // would silently stay dark after any network blip until the screen is
    // reopened. `disconnected` can be followed by one or more `connecting`
    // attempts before it lands on `connected` again, so what marks a
    // transition as a genuine reconnect (rather than the very first connect,
    // which `joinBooking` below already handles) is "has there been a drop
    // since the last time this was joined" — not just the immediately
    // preceding state.
    var droppedSinceLastJoin = false;
    final connectionSubscription = socket.connectionState.listen((
      connectionState,
    ) {
      if (connectionState == TrackingConnectionState.disconnected) {
        droppedSinceLastJoin = true;
        return;
      }
      if (connectionState == TrackingConnectionState.connected &&
          droppedSinceLastJoin) {
        droppedSinceLastJoin = false;
        unawaited(
          socket.joinBooking(bookingId).then((info) {
            state = AsyncData(info.lastLocation);
          }),
        );
      }
    });

    ref.onDispose(() {
      unawaited(locationSubscription.cancel());
      unawaited(connectionSubscription.cancel());
      unawaited(socket.leaveBooking(bookingId));
    });

    final info = await socket.joinBooking(bookingId);
    return info.lastLocation;
  }
}

final bookingTrackingProvider = AsyncNotifierProvider.autoDispose
    .family<BookingTrackingController, TrackedLocation?, String>(
      BookingTrackingController.new,
      retry: noAutomaticRetry,
    );

/// Whether a booking is currently in a stage where a customer would want to
/// see the provider's live location. Mirrors the backend's own trackable
/// statuses (`realtime.service.ts`).
extension TrackableBookingStatus on BookingStatus {
  bool get isTrackable => switch (this) {
    BookingStatus.accepted ||
    BookingStatus.enRoute ||
    BookingStatus.arrived ||
    BookingStatus.inProgress => true,
    _ => false,
  };
}

/// What [ProviderLocationBroadcastController] currently reflects. Three
/// genuinely different states, not one nullable status: "not trying to track"
/// (the booking isn't trackable, or the provider is offline) and "trying to
/// track but permission is blocking it" both need to be told apart in the UI
/// — collapsing them (e.g. into a nullable `LocationPermissionStatus?`) would
/// make "not tracking because offline" indistinguishable from "tracking,
/// permission granted".
sealed class ProviderTrackingStatus {
  const ProviderTrackingStatus();
}

/// The booking is not currently in a trackable stage, or the provider is
/// offline: nothing is being requested or sent.
class ProviderTrackingInactive extends ProviderTrackingStatus {
  const ProviderTrackingInactive();
}

/// Tracking should be running, but [status] is blocking it.
class ProviderTrackingBlocked extends ProviderTrackingStatus {
  const ProviderTrackingBlocked(this.status);
  final LocationPermissionStatus status;
}

/// Permission is granted and readings are being sent.
class ProviderTrackingActive extends ProviderTrackingStatus {
  const ProviderTrackingActive();
}

/// Drives location broadcasting for the currently signed-in provider on one
/// booking: starts a filtered GPS stream and forwards each reading over the
/// socket only while they are online AND that booking is in a trackable
/// stage, and stops the moment either stops being true (or this provider is
/// no longer watched, e.g. the booking detail screen was closed).
///
/// Scope note: this only runs while something is actively watching it (in
/// practice, the provider's own booking-detail screen for that job). There is
/// no background/foreground-service tracking yet — the app does not transmit
/// location while backgrounded or closed.
class ProviderLocationBroadcastController
    extends AsyncNotifier<ProviderTrackingStatus> {
  ProviderLocationBroadcastController(this.bookingId);

  final String bookingId;

  @override
  Future<ProviderTrackingStatus> build() async {
    _watchAccount(ref);
    final booking = ref.watch(bookingDetailProvider(bookingId)).value;
    final availability = ref.watch(providerProfileProvider).value?.availability;
    final shouldTrack =
        booking != null &&
        booking.status.isTrackable &&
        availability == ProviderAvailability.online;

    if (!shouldTrack) return const ProviderTrackingInactive();

    final locationService = ref.read(locationServiceProvider);
    final status = await locationService.requestPermission();
    if (!status.isGranted) return ProviderTrackingBlocked(status);

    final socket = ref.read(trackingSocketProvider);
    final subscription = locationService
        .watchPosition(
          distanceFilterMeters: kProviderTrackingDistanceFilterMeters,
        )
        .listen((reading) {
          // A rejection here (rate-limited, no longer trackable, briefly
          // disconnected) is routine, not a bug: the next reading tries
          // again on its own, nothing here needs to react to a single miss.
          unawaited(
            socket.sendLocationUpdate(bookingId, reading).catchError((_) {}),
          );
        });
    ref.onDispose(subscription.cancel);
    return const ProviderTrackingActive();
  }
}

final providerLocationBroadcastProvider = AsyncNotifierProvider.autoDispose
    .family<
      ProviderLocationBroadcastController,
      ProviderTrackingStatus,
      String
    >(ProviderLocationBroadcastController.new, retry: noAutomaticRetry);
