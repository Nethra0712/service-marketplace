import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/errors/error_message.dart';
import 'package:mobile/core/geo/geo_math.dart' as geo;
import 'package:mobile/core/location/location_providers.dart';
import 'package:mobile/core/location/permission_denied_view.dart';
import 'package:mobile/core/maps/app_map.dart';
import 'package:mobile/core/maps/map_point.dart';
import 'package:mobile/core/navigation/navigation_providers.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/tracking/application/tracking_providers.dart';
import 'package:mobile/features/tracking/domain/tracking_socket.dart';

const _mapHeight = 220.0;

/// Live tracking for one booking, shown on its detail screen while it is in
/// a trackable stage (see [TrackableBookingStatus.isTrackable]). Shows the
/// customer's service location to the provider (plus a navigate handoff),
/// and the provider's live location to the customer (plus distance/ETA).
class BookingTrackingSection extends ConsumerWidget {
  const BookingTrackingSection({
    required this.booking,
    required this.isCustomer,
    super.key,
  });

  final Booking booking;
  final bool isCustomer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!booking.status.isTrackable) return const SizedBox.shrink();
    return isCustomer
        ? _CustomerTrackingCard(booking: booking)
        : _ProviderTrackingCard(booking: booking);
  }
}

class _ProviderTrackingCard extends ConsumerWidget {
  const _ProviderTrackingCard({required this.booking});

  final Booking booking;

  Future<void> _navigate(WidgetRef ref, MapPoint point) async {
    final launcher = ref.read(urlLauncherServiceProvider);
    await launcher.launch(
      navigationHandoffUrl(
        latitude: point.latitude,
        longitude: point.longitude,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    // Watching this is what actually starts the location stream (see
    // ProviderLocationBroadcastController): it runs only while this card is
    // on screen and the booking is trackable.
    final broadcastState = ref.watch(
      providerLocationBroadcastProvider(booking.id),
    );
    final serviceLocation = booking.serviceLocation;

    return Card(
      child: Padding(
        padding: AppSpacing.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.trackingCustomerLocationTitle,
              style: textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            broadcastState.when(
              skipLoadingOnReload: true,
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text(errorMessage(l10n, error)),
              data: (trackingStatus) => switch (trackingStatus) {
                ProviderTrackingActive() => Text(
                  l10n.trackingSharingLocation,
                  key: const Key('sharing_location_indicator'),
                ),
                ProviderTrackingInactive() => Text(
                  l10n.trackingNotSharing,
                  key: const Key('not_sharing_location_indicator'),
                ),
                ProviderTrackingBlocked(:final status) => PermissionDeniedView(
                  status: status,
                  onRetry: () => ref.invalidate(
                    providerLocationBroadcastProvider(booking.id),
                  ),
                  onOpenAppSettings: () => unawaited(
                    ref.read(locationServiceProvider).openAppSettings(),
                  ),
                  onOpenLocationSettings: () => unawaited(
                    ref.read(locationServiceProvider).openLocationSettings(),
                  ),
                ),
              },
            ),
            if (serviceLocation != null) ...[
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                height: _mapHeight,
                child: AppMap(
                  markers: [
                    MapMarkerSpec(
                      id: 'customer',
                      point: serviceLocation,
                      kind: MapMarkerKind.customer,
                    ),
                  ],
                  initialCenter: serviceLocation,
                  interactive: false,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              FilledButton.icon(
                key: const Key('navigate_button'),
                onPressed: () => unawaited(_navigate(ref, serviceLocation)),
                icon: const Icon(Icons.navigation_outlined),
                label: Text(l10n.trackingNavigate),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CustomerTrackingCard extends ConsumerWidget {
  const _CustomerTrackingCard({required this.booking});

  final Booking booking;

  String _formatMinutes(Duration duration) {
    final minutes = duration.inMinutes;
    return minutes < 1 ? '<1' : '$minutes';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final trackingState = ref.watch(bookingTrackingProvider(booking.id));
    final connectionState = ref.watch(trackingConnectionStateProvider);
    final serviceLocation = booking.serviceLocation;

    return Card(
      child: Padding(
        padding: AppSpacing.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  l10n.trackingProviderLocationTitle,
                  style: textTheme.titleMedium,
                ),
                const Spacer(),
                _ConnectionBadge(
                  state:
                      connectionState.value ??
                      TrackingConnectionState.disconnected,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            trackingState.when(
              skipLoadingOnReload: true,
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text(
                errorMessage(l10n, error),
                key: const Key('tracking_error'),
              ),
              data: (location) {
                final markers = <MapMarkerSpec>[
                  if (serviceLocation != null)
                    MapMarkerSpec(
                      id: 'customer',
                      point: serviceLocation,
                      kind: MapMarkerKind.customer,
                    ),
                  if (location != null)
                    MapMarkerSpec(
                      id: 'provider',
                      point: MapPoint(
                        latitude: location.latitude,
                        longitude: location.longitude,
                      ),
                      kind: MapMarkerKind.provider,
                    ),
                ];
                if (markers.isEmpty) {
                  return Text(
                    l10n.trackingWaitingForLocation,
                    key: const Key('waiting_for_location'),
                  );
                }

                final km = (location != null && serviceLocation != null)
                    ? geo.distanceKm(
                        fromLatitude: location.latitude,
                        fromLongitude: location.longitude,
                        toLatitude: serviceLocation.latitude,
                        toLongitude: serviceLocation.longitude,
                      )
                    : null;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      height: _mapHeight,
                      child: AppMap(
                        markers: markers,
                        polylinePoints: markers.length == 2
                            ? [markers[0].point, markers[1].point]
                            : null,
                        interactive: false,
                      ),
                    ),
                    if (km != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        l10n.trackingDistanceAndEta(
                          km.toStringAsFixed(1),
                          _formatMinutes(geo.roughEta(km)),
                        ),
                        key: const Key('distance_eta'),
                      ),
                    ],
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ConnectionBadge extends StatelessWidget {
  const _ConnectionBadge({required this.state});

  final TrackingConnectionState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (label, color) = switch (state) {
      TrackingConnectionState.connected => (l10n.trackingLive, Colors.green),
      TrackingConnectionState.connecting => (
        l10n.trackingConnecting,
        Colors.orange,
      ),
      TrackingConnectionState.disconnected => (
        l10n.trackingDisconnected,
        Colors.red,
      ),
    };
    return Row(
      key: const Key('connection_badge'),
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.circle, size: 10, color: color),
        const SizedBox(width: AppSpacing.xs),
        Text(label, style: Theme.of(context).textTheme.labelSmall),
      ],
    );
  }
}
