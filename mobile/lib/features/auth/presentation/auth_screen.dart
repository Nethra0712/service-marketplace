import 'package:flutter/material.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/widgets/placeholder_screen.dart';

/// Placeholder. Authentication is not implemented yet.
class AuthScreen extends StatelessWidget {
  const AuthScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      PlaceholderScreen(title: AppLocalizations.of(context).authTitle);
}
