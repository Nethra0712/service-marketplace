import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/errors/error_message.dart';
import 'package:mobile/core/widgets/async_states.dart';
import 'package:mobile/features/provider/application/provider_providers.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';

const maxNameLength = 100;
const maxBioLength = 1000;
const maxYearsOfExperience = 60;

/// Create or edit the signed-in user's provider profile.
class ProviderProfileScreen extends ConsumerWidget {
  const ProviderProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final profile = ref.watch(providerProfileProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.providerProfileTitle)),
      body: SafeArea(
        child: profile.when(
          skipLoadingOnReload: true,
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(providerProfileProvider),
          ),
          // null means "creating"; otherwise the form starts from what is saved.
          data: (existing) => _ProfileForm(existing: existing),
        ),
      ),
    );
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({required this.existing});

  final ProviderProfile? existing;

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.fullName);
  late final _years = TextEditingController(
    text: widget.existing?.yearsOfExperience?.toString(),
  );
  late final _bio = TextEditingController(text: widget.existing?.bio);

  bool _saving = false;
  Object? _error;

  @override
  void dispose() {
    _name.dispose();
    _years.dispose();
    _bio.dispose();
    super.dispose();
  }

  String? _validateName(AppLocalizations l10n, String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return l10n.providerNameRequired;
    if (trimmed.length > maxNameLength) return l10n.providerNameTooLong;
    return null;
  }

  String? _validateYears(AppLocalizations l10n, String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return null; // optional
    final years = int.tryParse(trimmed);
    if (years == null || years < 0 || years > maxYearsOfExperience) {
      return l10n.providerYearsInvalid;
    }
    return null;
  }

  String? _validateBio(AppLocalizations l10n, String? value) =>
      (value?.trim().length ?? 0) > maxBioLength
      ? l10n.providerBioTooLong
      : null;

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final years = _years.text.trim();
      await ref
          .read(providerProfileProvider.notifier)
          .save(
            ProviderProfileInput(
              fullName: _name.text,
              bio: _bio.text,
              yearsOfExperience: years.isEmpty ? null : int.parse(years),
            ),
          );
      messenger.showSnackBar(SnackBar(content: Text(l10n.providerSaved)));
      if (router.canPop()) {
        router.pop();
      } else {
        router.go(AppRoutes.provider.path);
      }
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final error = _error;

    return Form(
      key: _formKey,
      child: ListView(
        padding: AppSpacing.screen,
        children: [
          TextFormField(
            key: const Key('full_name_field'),
            controller: _name,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: l10n.providerFullNameLabel,
              border: const OutlineInputBorder(),
            ),
            validator: (v) => _validateName(l10n, v),
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            key: const Key('years_field'),
            controller: _years,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: l10n.providerYearsLabel,
              border: const OutlineInputBorder(),
            ),
            validator: (v) => _validateYears(l10n, v),
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            key: const Key('bio_field'),
            controller: _bio,
            minLines: 3,
            maxLines: 6,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: l10n.providerBioLabel,
              hintText: l10n.providerBioHint,
              alignLabelWithHint: true,
              border: const OutlineInputBorder(),
            ),
            validator: (v) => _validateBio(l10n, v),
          ),
          if (error != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              errorMessage(l10n, error),
              key: const Key('save_error'),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            key: const Key('save_profile_button'),
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.providerSave),
          ),
        ],
      ),
    );
  }
}
