import 'package:flutter/material.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/theme/app_spacing.dart';

/// Standard scaffold for screens that are not built yet.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    required this.title,
    this.actions = const [],
    this.child,
    super.key,
  });

  final String title;
  final List<Widget> actions;

  /// Optional extra content shown under the placeholder notice.
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      body: SafeArea(
        child: Padding(
          padding: AppSpacing.screen,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.placeholderNotice,
                  style: textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                if (child != null) ...[
                  const SizedBox(height: AppSpacing.lg),
                  child!,
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
