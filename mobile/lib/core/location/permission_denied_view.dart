import 'package:flutter/material.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/location/location_permission_status.dart';

/// What to show in place of a location-dependent feature when permission is
/// not granted. Every non-granted status gets a message and the one action
/// that can actually fix it — never a bare "permission denied" dead end.
class PermissionDeniedView extends StatelessWidget {
  const PermissionDeniedView({
    required this.status,
    required this.onRetry,
    required this.onOpenAppSettings,
    required this.onOpenLocationSettings,
    super.key,
  });

  /// Never called with [LocationPermissionStatus.granted]: the caller only
  /// shows this view once it knows permission is not granted.
  final LocationPermissionStatus status;
  final VoidCallback onRetry;
  final VoidCallback onOpenAppSettings;
  final VoidCallback onOpenLocationSettings;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (message, action) = switch (status) {
      LocationPermissionStatus.denied => (
        l10n.locationPermissionDenied,
        (
          key: 'location_retry_button',
          label: l10n.locationRetry,
          onPressed: onRetry,
        ),
      ),
      LocationPermissionStatus.deniedForever => (
        l10n.locationPermissionDeniedForever,
        (
          key: 'location_open_app_settings_button',
          label: l10n.locationOpenSettings,
          onPressed: onOpenAppSettings,
        ),
      ),
      LocationPermissionStatus.serviceDisabled => (
        l10n.locationServiceDisabled,
        (
          key: 'location_open_location_settings_button',
          label: l10n.locationEnableGps,
          onPressed: onOpenLocationSettings,
        ),
      ),
      LocationPermissionStatus.granted => (l10n.locationPermissionDenied, null),
    };

    return Padding(
      padding: AppSpacing.screen,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.location_off_outlined),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  message,
                  key: const Key('location_permission_message'),
                ),
              ),
            ],
          ),
          if (action != null) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              key: Key(action.key),
              onPressed: action.onPressed,
              child: Text(action.label),
            ),
          ],
        ],
      ),
    );
  }
}
