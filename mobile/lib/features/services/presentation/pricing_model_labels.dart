import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

extension PricingModelLabels on PricingModel {
  String label(AppLocalizations l10n) => switch (this) {
    PricingModel.fixed => l10n.pricingFixed,
    PricingModel.hourly => l10n.pricingHourly,
    PricingModel.quote => l10n.pricingQuote,
  };

  /// One sentence explaining what the model means for the customer.
  String help(AppLocalizations l10n) => switch (this) {
    PricingModel.fixed => l10n.pricingFixedHelp,
    PricingModel.hourly => l10n.pricingHourlyHelp,
    PricingModel.quote => l10n.pricingQuoteHelp,
  };
}
