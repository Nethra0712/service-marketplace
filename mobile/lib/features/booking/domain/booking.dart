import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/booking/domain/offer.dart';
import 'package:mobile/features/booking/domain/quote.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

/// A person referenced by a booking: the customer, or the assigned provider.
class BookingParty {
  const BookingParty({required this.id, this.fullName});

  factory BookingParty.fromJson(Map<String, dynamic> json) => BookingParty(
    id: readString(json, 'id'),
    fullName: readStringOrNull(json, 'fullName'),
  );

  final String id;
  final String? fullName;
}

/// How and when a booking was cancelled.
class Cancellation {
  const Cancellation({required this.at, required this.byUserId, this.reason});

  factory Cancellation.fromJson(Map<String, dynamic> json) => Cancellation(
    at: DateTime.parse(readString(json, 'at')),
    byUserId: readString(json, 'byUserId'),
    reason: readStringOrNull(json, 'reason'),
  );

  final DateTime at;
  final String byUserId;
  final String? reason;
}

/// The lifecycle timestamps a booking accumulates as it progresses. Each is
/// set from the moment the booking first reaches that stage and stays set
/// afterwards, so "has it passed en-route" is just a null check.
class BookingTimestamps {
  const BookingTimestamps({
    required this.createdAt,
    required this.updatedAt,
    this.acceptedAt,
    this.enRouteAt,
    this.arrivedAt,
    this.workStartedAt,
    this.completedAt,
  });

  factory BookingTimestamps.fromJson(Map<String, dynamic> json) =>
      BookingTimestamps(
        createdAt: DateTime.parse(readString(json, 'createdAt')),
        updatedAt: DateTime.parse(readString(json, 'updatedAt')),
        acceptedAt: readDateTimeOrNull(json, 'acceptedAt'),
        enRouteAt: readDateTimeOrNull(json, 'enRouteAt'),
        arrivedAt: readDateTimeOrNull(json, 'arrivedAt'),
        workStartedAt: readDateTimeOrNull(json, 'workStartedAt'),
        completedAt: readDateTimeOrNull(json, 'completedAt'),
      );

  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? acceptedAt;
  final DateTime? enRouteAt;
  final DateTime? arrivedAt;
  final DateTime? workStartedAt;
  final DateTime? completedAt;
}

/// A customer's request for a service, from creation through completion or
/// cancellation. `quotes` is always present for a quote-priced booking, but
/// its contents depend on who asked: the customer sees every quote, a
/// provider sees only their own.
class Booking {
  const Booking({
    required this.id,
    required this.status,
    required this.bookingType,
    required this.pricingModel,
    required this.categoryId,
    required this.categorySlug,
    required this.categoryName,
    required this.citySlug,
    required this.cityName,
    required this.serviceAddress,
    required this.customer,
    required this.timestamps,
    required this.quotes,
    this.scheduledAt,
    this.customerNotes,
    this.agreedAmount,
    this.provider,
    this.cancellation,
    this.myOffer,
  });

  factory Booking.fromJson(Map<String, dynamic> json) {
    final category = asJsonObject(json['category']);
    final city = asJsonObject(json['city']);
    final provider = json['provider'];
    final cancellation = json['cancellation'];
    final myOffer = json['myOffer'];
    return Booking(
      id: readString(json, 'id'),
      status: readBookingStatus(json, 'status'),
      bookingType: readBookingType(json, 'bookingType'),
      pricingModel: readEnum(PricingModel.values, json, 'pricingModel'),
      categoryId: readString(category, 'id'),
      categorySlug: readString(category, 'slug'),
      categoryName: readString(category, 'name'),
      citySlug: readString(city, 'slug'),
      cityName: readString(city, 'name'),
      scheduledAt: readDateTimeOrNull(json, 'scheduledAt'),
      serviceAddress: readString(json, 'serviceAddress'),
      customerNotes: readStringOrNull(json, 'customerNotes'),
      agreedAmount: readStringOrNull(json, 'agreedAmount'),
      customer: BookingParty.fromJson(asJsonObject(json['customer'])),
      provider: provider == null
          ? null
          : BookingParty.fromJson(asJsonObject(provider)),
      timestamps: BookingTimestamps.fromJson(asJsonObject(json['timestamps'])),
      cancellation: cancellation == null
          ? null
          : Cancellation.fromJson(asJsonObject(cancellation)),
      myOffer: myOffer == null ? null : Offer.fromJson(asJsonObject(myOffer)),
      quotes: readObjects(
        json,
        'quotes',
      ).map(Quote.fromJson).toList(growable: false),
    );
  }

  final String id;
  final BookingStatus status;
  final BookingType bookingType;
  final PricingModel pricingModel;
  final String categoryId;
  final String categorySlug;
  final String categoryName;
  final String citySlug;
  final String cityName;
  final DateTime? scheduledAt;
  final String serviceAddress;
  final String? customerNotes;

  /// A decimal string, e.g. `"3500.00"`, LKR. Set once agreed (today, only
  /// from an accepted quote).
  final String? agreedAmount;
  final BookingParty customer;
  final BookingParty? provider;
  final BookingTimestamps timestamps;
  final Cancellation? cancellation;

  /// The viewing provider's own dispatch offer on this booking, if any. Never
  /// set for a customer's view.
  final Offer? myOffer;
  final List<Quote> quotes;

  bool get isQuotePriced => pricingModel == PricingModel.quote;

  /// Whether *a* customer cancel action could still apply from this status
  /// (ownership is decided by who is asking, not by this booking alone).
  bool get isCancellable => switch (status) {
    BookingStatus.searching ||
    BookingStatus.accepted ||
    BookingStatus.enRoute ||
    BookingStatus.arrived => true,
    BookingStatus.inProgress ||
    BookingStatus.completed ||
    BookingStatus.cancelled ||
    BookingStatus.expired => false,
  };

  /// Whether the assigned provider could still release this job.
  bool get isReleasable => switch (status) {
    BookingStatus.accepted ||
    BookingStatus.enRoute ||
    BookingStatus.arrived => true,
    _ => false,
  };
}
