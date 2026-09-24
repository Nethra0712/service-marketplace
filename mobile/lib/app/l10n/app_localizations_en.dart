// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Service Marketplace';

  @override
  String get homeWelcome => 'Welcome to Service Marketplace';

  @override
  String get homeSubtitle => 'Home services, on demand.';

  @override
  String homeSignedInAs(String phone) {
    return 'Signed in as $phone';
  }

  @override
  String get servicesTitle => 'Services';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profilePhoneLabel => 'Mobile number';

  @override
  String get placeholderNotice => 'This screen is a placeholder.';

  @override
  String get pageNotFoundTitle => 'Page not found';

  @override
  String get languageLabel => 'Language';

  @override
  String get languageSystemDefault => 'Device language';

  @override
  String get authTitle => 'Sign in';

  @override
  String get authPhoneIntro =>
      'Enter your mobile number and we\'ll text you a verification code.';

  @override
  String get authPhoneLabel => 'Mobile number';

  @override
  String get authPhoneHint => '77 123 4567';

  @override
  String get authSendCode => 'Send code';

  @override
  String get authVerifyTitle => 'Verify your number';

  @override
  String authVerifyInstruction(String phone) {
    return 'Enter the code we sent to $phone.';
  }

  @override
  String get authCodeLabel => 'Verification code';

  @override
  String get authVerify => 'Verify';

  @override
  String get authResendCode => 'Resend code';

  @override
  String authResendIn(int seconds) {
    return 'Resend code in ${seconds}s';
  }

  @override
  String get authChangeNumber => 'Use a different number';

  @override
  String get authSignOut => 'Sign out';

  @override
  String get errorInvalidPhone => 'Enter a valid Sri Lankan mobile number.';

  @override
  String get errorInvalidCode => 'That code is incorrect or has expired.';

  @override
  String get errorAttemptsExceeded =>
      'Too many incorrect attempts. Request a new code.';

  @override
  String get errorCooldown =>
      'Please wait a moment before requesting another code.';

  @override
  String get errorRateLimited => 'Too many attempts. Please try again later.';

  @override
  String get errorNetwork =>
      'Can\'t reach the server. Check your connection and try again.';

  @override
  String get errorSmsUnavailable =>
      'We couldn\'t send the code. Please try again shortly.';

  @override
  String get errorAccountSuspended => 'This account is suspended.';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';

  @override
  String get commonRetry => 'Try again';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get servicesSearchHint => 'Search services';

  @override
  String get servicesFilterAll => 'All';

  @override
  String get servicesEmpty => 'No services are available yet.';

  @override
  String get servicesNoMatch => 'No services match your search.';

  @override
  String get servicesClearFilters => 'Clear filters';

  @override
  String get pricingFixed => 'Fixed price';

  @override
  String get pricingHourly => 'Per hour';

  @override
  String get pricingQuote => 'Quote on request';

  @override
  String get pricingFixedHelp => 'A set price for the job.';

  @override
  String get pricingHourlyHelp =>
      'You pay for the time the provider spends on the job.';

  @override
  String get pricingQuoteHelp =>
      'The provider quotes a price once they understand the job.';

  @override
  String get serviceDetailPricing => 'How pricing works';

  @override
  String get serviceDetailAvailableIn => 'Available in';

  @override
  String serviceDetailProviders(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count approved providers',
      one: '1 approved provider',
      zero: 'No approved providers yet',
    );
    return '$_temp0';
  }

  @override
  String get serviceDetailNotAvailable =>
      'This service isn\'t available right now.';

  @override
  String get serviceDetailOffer => 'Offer this service';

  @override
  String get homeProviderArea => 'Provider area';

  @override
  String get providerAreaTitle => 'Provider area';

  @override
  String get providerIntroTitle => 'Earn by offering your skills';

  @override
  String get providerIntroBody =>
      'Create a provider profile, choose the services you offer, and we\'ll review your application.';

  @override
  String get providerSetupProfile => 'Set up provider profile';

  @override
  String get providerEditProfile => 'Edit profile';

  @override
  String get providerProfileTitle => 'Provider profile';

  @override
  String get providerFullNameLabel => 'Full name';

  @override
  String get providerYearsLabel => 'Years of experience';

  @override
  String get providerBioLabel => 'About you';

  @override
  String get providerBioHint => 'Describe your skills and the work you do.';

  @override
  String get providerSave => 'Save profile';

  @override
  String get providerSaved => 'Profile saved.';

  @override
  String get providerNameRequired => 'Enter your full name.';

  @override
  String get providerNameTooLong =>
      'Your name must be 100 characters or fewer.';

  @override
  String get providerYearsInvalid => 'Enter a whole number from 0 to 60.';

  @override
  String get providerBioTooLong => 'Keep this to 1000 characters or fewer.';

  @override
  String get providerSubmitForReview => 'Submit for review';

  @override
  String get providerSubmitted => 'Profile submitted for review.';

  @override
  String providerReviewNote(String note) {
    return 'Reviewer\'s note: $note';
  }

  @override
  String get verificationDraft => 'Not submitted';

  @override
  String get verificationSubmitted => 'Under review';

  @override
  String get verificationVerified => 'Verified';

  @override
  String get verificationRejected => 'Not approved';

  @override
  String get verificationDraftHelp =>
      'Submit your profile so we can review it.';

  @override
  String get verificationSubmittedHelp =>
      'We\'re reviewing your profile. The result will appear here.';

  @override
  String get verificationVerifiedHelp =>
      'Your profile is verified. Customers can book you for services that are approved.';

  @override
  String get verificationRejectedHelp =>
      'Your profile wasn\'t approved. Update it and submit again.';

  @override
  String get providerMyServices => 'My services';

  @override
  String get providerManageServices => 'Manage services';

  @override
  String get providerAddServices => 'Add services';

  @override
  String providerServicesSummary(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count service applications',
      one: '1 service application',
      zero: 'You haven\'t applied for any services yet.',
    );
    return '$_temp0';
  }

  @override
  String get providerVerifyFirst =>
      'Customers can only find you once your profile is verified.';

  @override
  String get providerAvailabilityTitle => 'Availability';

  @override
  String get providerAvailabilityOnline => 'Online — visible for new jobs';

  @override
  String get providerAvailabilityOffline => 'Offline — not receiving offers';

  @override
  String get providerAvailabilityHelp =>
      'Go online to be matched with nearby customers.';

  @override
  String get providerAvailabilityUpdated => 'Availability updated.';

  @override
  String get applicationPending => 'Pending review';

  @override
  String get applicationApproved => 'Approved';

  @override
  String get applicationRejected => 'Rejected';

  @override
  String get applicationSuspended => 'Suspended';

  @override
  String get applicationPendingHelp => 'We\'re reviewing this application.';

  @override
  String get applicationApprovedHelp => 'You\'re approved for this service.';

  @override
  String get applicationRejectedHelp =>
      'This application wasn\'t approved. You can apply again.';

  @override
  String get applicationSuspendedHelp =>
      'You can\'t take jobs in this service right now.';

  @override
  String get providerApplyTitle => 'Apply for services';

  @override
  String get providerApplyIntro =>
      'Choose the services you want to offer. Each one is reviewed separately.';

  @override
  String get providerApplyCity => 'City';

  @override
  String get providerApplyNothingLeft =>
      'You\'ve already applied for every available service.';

  @override
  String get providerApplyNeedProfile =>
      'Set up your provider profile before applying for services.';

  @override
  String providerApplyButton(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Apply for $count services',
      one: 'Apply for 1 service',
    );
    return '$_temp0';
  }

  @override
  String providerApplySent(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count applications sent.',
      one: 'Application sent.',
    );
    return '$_temp0';
  }

  @override
  String providerApplyPartial(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count applications couldn\'t be sent.',
      one: '1 application couldn\'t be sent.',
    );
    return '$_temp0';
  }

  @override
  String get providerResubmit => 'Apply again';

  @override
  String get providerResubmitted => 'Application sent again.';

  @override
  String get providerWithdraw => 'Withdraw';

  @override
  String get providerWithdrawTitle => 'Withdraw application?';

  @override
  String providerWithdrawBody(String service) {
    return 'Withdraw your application for $service? You can apply again later.';
  }

  @override
  String get providerWithdrawn => 'Application withdrawn.';

  @override
  String get errorAlreadyApplied => 'You\'ve already applied for this service.';

  @override
  String get errorProfileIncomplete =>
      'Add your name and apply for at least one service before submitting.';

  @override
  String get errorInvalidState =>
      'That can\'t be done in the current state. Refresh and try again.';

  @override
  String get errorProfileRequired => 'Set up your provider profile first.';

  @override
  String get errorNotFound =>
      'We couldn\'t find that. It may no longer be available.';

  @override
  String get errorValidation => 'Please check the details you entered.';

  @override
  String get serviceDetailRequest => 'Request this service';

  @override
  String get bookingHistoryTitle => 'My bookings';

  @override
  String get bookingHistoryActive => 'Active';

  @override
  String get bookingHistoryPast => 'Past';

  @override
  String get bookingHistoryActiveEmpty => 'You have no active bookings.';

  @override
  String get bookingHistoryPastEmpty => 'You have no past bookings yet.';

  @override
  String get bookingDetailTitle => 'Booking';

  @override
  String get bookingCategoryLabel => 'Service';

  @override
  String get bookingCityLabel => 'City';

  @override
  String get bookingPricingLabel => 'Pricing';

  @override
  String get bookingAgreedAmountLabel => 'Agreed price';

  @override
  String bookingAmountLkr(String amount) {
    return 'LKR $amount';
  }

  @override
  String get bookingScheduledLabel => 'Scheduled for';

  @override
  String get bookingAddressLabel => 'Address';

  @override
  String get bookingNotesLabel => 'Notes';

  @override
  String get bookingCustomerLabel => 'Customer';

  @override
  String get bookingProviderLabel => 'Provider';

  @override
  String get bookingNameUnknown => 'Not given';

  @override
  String get bookingTimelineLabel => 'Timeline';

  @override
  String get bookingTimelineEmpty => 'Nothing has happened yet.';

  @override
  String get bookingStatusSearching => 'Looking for a provider';

  @override
  String get bookingStatusSearchingHelp =>
      'We\'re showing this request to providers who can do this job.';

  @override
  String get bookingStatusAccepted => 'Accepted';

  @override
  String get bookingStatusAcceptedHelp =>
      'A provider has accepted. They\'ll set off when it\'s time.';

  @override
  String get bookingStatusEnRoute => 'On the way';

  @override
  String get bookingStatusEnRouteHelp => 'Your provider is on their way.';

  @override
  String get bookingStatusArrived => 'Arrived';

  @override
  String get bookingStatusArrivedHelp => 'Your provider has arrived.';

  @override
  String get bookingStatusInProgress => 'In progress';

  @override
  String get bookingStatusInProgressHelp => 'Work is under way.';

  @override
  String get bookingStatusCompleted => 'Completed';

  @override
  String get bookingStatusCompletedHelp => 'This job is done.';

  @override
  String get bookingStatusCancelled => 'Cancelled';

  @override
  String get bookingStatusCancelledHelp => 'This booking was cancelled.';

  @override
  String get bookingStatusExpired => 'No provider found';

  @override
  String get bookingStatusExpiredHelp =>
      'We couldn\'t find an available provider in time. You can try requesting again.';

  @override
  String get bookingCancel => 'Cancel booking';

  @override
  String get bookingCancelTitle => 'Cancel this booking?';

  @override
  String get bookingCancelBody => 'Let us know why you\'re cancelling.';

  @override
  String get bookingCancelReasonLabel => 'Reason';

  @override
  String get bookingCancelled => 'Booking cancelled.';

  @override
  String bookingCancelReason(String reason) {
    return 'Reason: $reason';
  }

  @override
  String get bookingRelease => 'Release this job';

  @override
  String get bookingReleaseTitle => 'Release this job?';

  @override
  String get bookingReleaseBody =>
      'It will go back to being an open request for another provider to take.';

  @override
  String get bookingReleaseReasonLabel => 'Reason';

  @override
  String get bookingReleased => 'Job released.';

  @override
  String get bookingAcceptJob => 'Accept this job';

  @override
  String get bookingAcceptedMessage => 'Job accepted.';

  @override
  String get bookingDeclineOffer => 'Decline';

  @override
  String get bookingOfferDeclined => 'Offer declined.';

  @override
  String bookingOfferRespondBy(String time) {
    return 'Respond by $time';
  }

  @override
  String get bookingStartEnRoute => 'I\'m on my way';

  @override
  String get bookingEnRouteStarted => 'Marked as on the way.';

  @override
  String get bookingMarkArrived => 'I\'ve arrived';

  @override
  String get bookingArrivedMarked => 'Marked as arrived.';

  @override
  String get bookingStartWork => 'Start work';

  @override
  String get bookingWorkStarted => 'Work started.';

  @override
  String get bookingComplete => 'Mark as complete';

  @override
  String get bookingCompletedMessage => 'Booking marked as complete.';

  @override
  String get bookingQuotesTitle => 'Quotes';

  @override
  String get bookingNoQuotesYet => 'No quotes yet.';

  @override
  String get bookingSubmitQuote => 'Submit a quote';

  @override
  String get bookingQuoteAmountLabel => 'Your price';

  @override
  String get bookingQuoteAmountInvalid => 'Enter an amount greater than zero.';

  @override
  String get bookingQuoteNoteLabel => 'Note (optional)';

  @override
  String get bookingQuoteSubmit => 'Send quote';

  @override
  String get bookingQuoteSubmitted => 'Quote sent.';

  @override
  String get bookingAcceptQuote => 'Accept';

  @override
  String get bookingRejectQuote => 'Decline';

  @override
  String get bookingQuoteAccepted => 'Quote accepted.';

  @override
  String get bookingQuoteRejected => 'Quote declined.';

  @override
  String get quoteStatusPending => 'Pending';

  @override
  String get quoteStatusAccepted => 'Accepted';

  @override
  String get quoteStatusRejected => 'Declined';

  @override
  String get providerJobsTitle => 'Jobs';

  @override
  String get providerJobsOpen => 'Offers';

  @override
  String get providerJobsAssigned => 'My jobs';

  @override
  String get providerJobsOpenEmpty =>
      'No offers right now. Go online to start receiving them.';

  @override
  String get providerJobsAssignedEmpty => 'You have no assigned jobs yet.';

  @override
  String get serviceRequestTitle => 'Request this service';

  @override
  String get serviceRequestOnDemand => 'Now';

  @override
  String get serviceRequestScheduled => 'Schedule';

  @override
  String get serviceRequestPickTime => 'Choose a date and time';

  @override
  String get serviceRequestScheduledTimeInvalid =>
      'Choose a time in the future.';

  @override
  String get serviceRequestAddressLabel => 'Service address';

  @override
  String get serviceRequestAddressHint => 'Where should the provider come?';

  @override
  String get serviceRequestAddressRequired => 'Enter the service address.';

  @override
  String get serviceRequestAddressTooLong =>
      'Keep this to 500 characters or fewer.';

  @override
  String get serviceRequestNotesLabel => 'Notes for the provider (optional)';

  @override
  String get serviceRequestNotesHint =>
      'Anything the provider should know beforehand.';

  @override
  String get serviceRequestNotesTooLong =>
      'Keep this to 1000 characters or fewer.';

  @override
  String get serviceRequestSubmit => 'Request service';

  @override
  String get serviceRequestSent => 'Request sent.';

  @override
  String get serviceRequestUseMyLocation => 'Use my current location';

  @override
  String get serviceRequestLocationSet => 'Precise location added.';

  @override
  String get serviceRequestClearLocation => 'Remove precise location';

  @override
  String get locationPermissionDenied => 'Location access was not granted.';

  @override
  String get locationRetry => 'Try again';

  @override
  String get locationPermissionDeniedForever =>
      'Location access is turned off for this app. Turn it on in Settings to use this.';

  @override
  String get locationOpenSettings => 'Open settings';

  @override
  String get locationServiceDisabled =>
      'Location (GPS) is turned off on this device.';

  @override
  String get locationEnableGps => 'Turn on location';

  @override
  String get trackingCustomerLocationTitle => 'Customer location';

  @override
  String get trackingProviderLocationTitle => 'Provider location';

  @override
  String get trackingSharingLocation =>
      'Sharing your location with the customer.';

  @override
  String get trackingNotSharing => 'Not sharing your location right now.';

  @override
  String get trackingWaitingForLocation => 'Waiting for a location update.';

  @override
  String get trackingNavigate => 'Navigate';

  @override
  String trackingDistanceAndEta(String distanceKm, String minutes) {
    return '$distanceKm km away · about $minutes min';
  }

  @override
  String get trackingLive => 'Live';

  @override
  String get trackingConnecting => 'Connecting…';

  @override
  String get trackingDisconnected => 'Reconnecting…';

  @override
  String get errorQuoteNotApplicable =>
      'That\'s not available for this kind of service.';

  @override
  String get errorProviderNotEligible =>
      'You\'re not approved for this service in this city.';

  @override
  String get errorAlreadyQuoted =>
      'You\'ve already sent a quote for this booking.';

  @override
  String get errorPaymentNotReady =>
      'This booking hasn\'t been completed yet, so there\'s nothing to pay.';

  @override
  String get errorPaymentAlreadyFinal => 'This booking has already been paid.';

  @override
  String get errorNotBookingParticipant => 'You\'re not part of this booking.';

  @override
  String get errorBookingNotCompleted =>
      'This booking hasn\'t been completed yet.';

  @override
  String get errorAlreadyReviewed => 'You\'ve already reviewed this booking.';

  @override
  String get errorDeviceTokenNotOwned =>
      'That device isn\'t registered to your account.';

  @override
  String get paymentSectionTitle => 'Payment';

  @override
  String get paymentStatusPending => 'Payment pending';

  @override
  String get paymentStatusSucceeded => 'Paid';

  @override
  String get paymentStatusFailed => 'Payment failed';

  @override
  String get paymentStatusCancelled => 'Payment cancelled';

  @override
  String get paymentStatusRefunded => 'Refunded';

  @override
  String get paymentServiceAmountLabel => 'Service amount';

  @override
  String get paymentCommissionLabel => 'Platform fee';

  @override
  String get paymentProviderEarningLabel => 'You earn';

  @override
  String get paymentPayNow => 'Pay now';

  @override
  String get paymentRetry => 'Try payment again';

  @override
  String get paymentCheckoutOpened =>
      'Checkout opened in your browser. Come back here once you\'ve paid.';

  @override
  String get paymentCheckoutOpenFailed => 'Couldn\'t open the checkout page.';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsEmpty => 'No notifications yet.';

  @override
  String get notificationMarkAllRead => 'Mark all as read';

  @override
  String get notificationPermissionTitle => 'Stay updated';

  @override
  String get notificationPermissionBody =>
      'Turn on notifications to know when your booking status changes, a quote arrives, or a payment completes.';

  @override
  String get notificationPermissionAllow => 'Turn on notifications';

  @override
  String get notificationPermissionNotNow => 'Not now';

  @override
  String get notificationPreferencesTitle => 'Push notifications';

  @override
  String get notificationPreferencesSubtitle =>
      'Get a push notification for important updates, in addition to your in-app notification list.';

  @override
  String get reviewSectionTitle => 'Reviews';

  @override
  String get reviewRatingLabel => 'Your rating';

  @override
  String get reviewCommentLabel => 'Comment (optional)';

  @override
  String get reviewCommentHint => 'Share more about your experience';

  @override
  String get reviewSubmit => 'Submit review';

  @override
  String get reviewSubmitted => 'Review submitted.';

  @override
  String get reviewYourReview => 'Your review';

  @override
  String get reviewCounterpartReview => 'Their review';

  @override
  String get reviewNoComment => 'No comment left.';
}
