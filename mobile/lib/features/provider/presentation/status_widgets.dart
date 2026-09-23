import 'package:flutter/material.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/widgets/status_chip.dart';
import 'package:mobile/features/provider/domain/provider_application.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';

export 'package:mobile/core/widgets/status_chip.dart';

extension VerificationStatusLabels on VerificationStatus {
  String label(AppLocalizations l10n) => switch (this) {
    VerificationStatus.draft => l10n.verificationDraft,
    VerificationStatus.submitted => l10n.verificationSubmitted,
    VerificationStatus.verified => l10n.verificationVerified,
    VerificationStatus.rejected => l10n.verificationRejected,
  };

  String help(AppLocalizations l10n) => switch (this) {
    VerificationStatus.draft => l10n.verificationDraftHelp,
    VerificationStatus.submitted => l10n.verificationSubmittedHelp,
    VerificationStatus.verified => l10n.verificationVerifiedHelp,
    VerificationStatus.rejected => l10n.verificationRejectedHelp,
  };

  IconData get icon => switch (this) {
    VerificationStatus.draft => Icons.edit_note,
    VerificationStatus.submitted => Icons.hourglass_top,
    VerificationStatus.verified => Icons.verified,
    VerificationStatus.rejected => Icons.cancel_outlined,
  };
}

extension ApplicationStatusLabels on ApplicationStatus {
  String label(AppLocalizations l10n) => switch (this) {
    ApplicationStatus.pending => l10n.applicationPending,
    ApplicationStatus.approved => l10n.applicationApproved,
    ApplicationStatus.rejected => l10n.applicationRejected,
    ApplicationStatus.suspended => l10n.applicationSuspended,
  };

  String help(AppLocalizations l10n) => switch (this) {
    ApplicationStatus.pending => l10n.applicationPendingHelp,
    ApplicationStatus.approved => l10n.applicationApprovedHelp,
    ApplicationStatus.rejected => l10n.applicationRejectedHelp,
    ApplicationStatus.suspended => l10n.applicationSuspendedHelp,
  };

  IconData get icon => switch (this) {
    ApplicationStatus.pending => Icons.hourglass_top,
    ApplicationStatus.approved => Icons.check_circle,
    ApplicationStatus.rejected => Icons.cancel_outlined,
    ApplicationStatus.suspended => Icons.pause_circle_outline,
  };
}

StatusTone toneOfVerification(VerificationStatus status) => switch (status) {
  VerificationStatus.verified => StatusTone.good,
  VerificationStatus.rejected => StatusTone.bad,
  _ => StatusTone.neutral,
};

StatusTone toneOfApplication(ApplicationStatus status) => switch (status) {
  ApplicationStatus.approved => StatusTone.good,
  ApplicationStatus.rejected || ApplicationStatus.suspended => StatusTone.bad,
  ApplicationStatus.pending => StatusTone.neutral,
};
