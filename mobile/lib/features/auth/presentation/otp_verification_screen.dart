import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/l10n/language_menu.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/utils/clock.dart';
import 'package:mobile/features/auth/application/otp_flow_controller.dart';
import 'package:mobile/features/auth/application/otp_flow_state.dart';
import 'package:mobile/features/auth/domain/phone_number.dart';
import 'package:mobile/features/auth/presentation/auth_error_messages.dart';

/// Second step of sign-in: type the code that arrived by SMS.
class OtpVerificationScreen extends ConsumerStatefulWidget {
  const OtpVerificationScreen({super.key});

  @override
  ConsumerState<OtpVerificationScreen> createState() =>
      _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final _controller = TextEditingController();
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    // Re-render every second so the resend countdown ticks down.
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _verify() =>
      ref.read(otpFlowControllerProvider.notifier).submitCode(_controller.text);

  void _changeNumber() => context.pop();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final flow = ref.watch(otpFlowControllerProvider);
    final now = ref.watch(clockProvider)();

    // A fresh code was issued (resend): start with an empty field.
    ref.listen<OtpFlowState>(otpFlowControllerProvider, (previous, next) {
      if (previous?.challenge?.challengeId != next.challenge?.challengeId) {
        _controller.clear();
      }
    });

    // Reached without a code to check (e.g. the state was discarded): go back.
    if (flow.challenge == null && !flow.isBusy) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go(AppRoutes.auth.path);
      });
      return const Scaffold();
    }

    final verifying = flow.status == OtpFlowStatus.verifying;
    final canResend = flow.canResend(now);
    final error = flow.error;

    return PopScope(
      // Leaving this screen (system back or the button below) discards the
      // pending code so the phone screen starts clean.
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) ref.read(otpFlowControllerProvider.notifier).changeNumber();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.authVerifyTitle),
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
                  l10n.authVerifyInstruction(
                    formatPhoneForDisplay(flow.phoneE164 ?? ''),
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.lg),
                TextField(
                  key: const Key('code_field'),
                  controller: _controller,
                  enabled: !flow.isBusy,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  textAlign: TextAlign.center,
                  maxLength: 8,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: Theme.of(context).textTheme.headlineSmall,
                  decoration: InputDecoration(
                    labelText: l10n.authCodeLabel,
                    counterText: '',
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
                  onSubmitted: (_) => _verify(),
                ),
                const SizedBox(height: AppSpacing.lg),
                FilledButton(
                  key: const Key('verify_button'),
                  onPressed: flow.isBusy ? null : _verify,
                  child: verifying
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.authVerify),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton(
                  key: const Key('resend_button'),
                  onPressed: canResend && !flow.isBusy
                      ? () => ref
                            .read(otpFlowControllerProvider.notifier)
                            .resend()
                      : null,
                  child: Text(
                    canResend
                        ? l10n.authResendCode
                        : l10n.authResendIn(flow.secondsUntilResend(now)),
                  ),
                ),
                TextButton(
                  key: const Key('change_number_button'),
                  onPressed: flow.isBusy ? null : _changeNumber,
                  child: Text(l10n.authChangeNumber),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
