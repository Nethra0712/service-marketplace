import 'package:flutter/material.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/widgets/placeholder_screen.dart';

/// Placeholder for the user profile.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      PlaceholderScreen(title: AppLocalizations.of(context).profileTitle);
}
