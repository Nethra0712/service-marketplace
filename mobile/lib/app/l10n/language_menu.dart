import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/locale_provider.dart';

/// App-bar action for switching the UI language.
class LanguageMenu extends ConsumerWidget {
  const LanguageMenu({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final selected = ref.watch(localeProvider);

    return PopupMenuButton<Locale?>(
      tooltip: l10n.languageLabel,
      icon: const Icon(Icons.language),
      initialValue: selected,
      onSelected: ref.read(localeProvider.notifier).select,
      itemBuilder: (context) => [
        PopupMenuItem<Locale?>(child: Text(l10n.languageSystemDefault)),
        for (final locale in AppLocales.supported)
          PopupMenuItem<Locale?>(
            value: locale,
            child: Text(AppLocales.nativeName(locale)),
          ),
      ],
    );
  }
}
