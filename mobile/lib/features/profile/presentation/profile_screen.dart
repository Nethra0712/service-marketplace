import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/widgets/placeholder_screen.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/domain/phone_number.dart';

/// Placeholder for the user profile. Shows only what sign-in already provides.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final user = ref.watch(currentUserProvider);

    return PlaceholderScreen(
      title: l10n.profileTitle,
      child: user == null
          ? null
          : ListTile(
              leading: const Icon(Icons.phone_outlined),
              title: Text(l10n.profilePhoneLabel),
              subtitle: Text(formatPhoneForDisplay(user.phone)),
            ),
    );
  }
}
