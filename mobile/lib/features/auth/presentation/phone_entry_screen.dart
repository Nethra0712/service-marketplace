import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/language_menu.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/features/auth/application/otp_flow_controller.dart';
import 'package:mobile/features/auth/application/otp_flow_state.dart';
import 'package:mobile/features/auth/domain/phone_number.dart';
import 'package:mobile/features/auth/presentation/auth_error_messages.dart';

/// First step of sign-in: enter a mobile number to receive a code.
class PhoneEntryScreen extends ConsumerStatefulWidget {
  const PhoneEntryScreen({super.key});

  @override
  ConsumerState<PhoneEntryScreen> createState() => _PhoneEntryScreenState();
}

class _PhoneEntryScreenState extends ConsumerState<PhoneEntryScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final sent = await ref
        .read(otpFlowControllerProvider.notifier)
        .submitPhone(_controller.text);
    if (sent && mounted) {
      await context.push(AppRoutes.otp.path);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final flow = ref.watch(otpFlowControllerProvider);
    final requesting = flow.status == OtpFlowStatus.requestingCode;
    final error = flow.error;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.authTitle),
        actions: const [LanguageMenu()],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.screen,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.lg),
              Text(
                l10n.authPhoneIntro,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextField(
                key: const Key('phone_field'),
                controller: _controller,
                enabled: !flow.isBusy,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.telephoneNumberNational],
                decoration: InputDecoration(
                  labelText: l10n.authPhoneLabel,
                  hintText: l10n.authPhoneHint,
                  prefixText: '+$defaultCallingCode ',
                  errorText: error == null
                      ? null
                      : otpErrorMessage(l10n, error),
                  errorMaxLines: 3,
                ),
                onChanged: (_) {
                  if (error != null) {
                    ref.read(otpFlowControllerProvider.notifier).clearError();
                  }
                },
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                key: const Key('send_code_button'),
                onPressed: flow.isBusy ? null : _submit,
                child: requesting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(l10n.authSendCode),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
