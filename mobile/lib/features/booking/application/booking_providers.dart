import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/network_providers.dart';
import 'package:mobile/core/utils/provider_retry.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/booking/data/booking_api_repository.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_repository.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/services/application/catalogue_providers.dart';

final bookingRepositoryProvider = Provider<BookingRepository>(
  (ref) => BookingApiRepository(ref.watch(apiClientProvider)),
);

/// Ties booking state to being signed in, exactly like the provider feature:
/// every controller here starts over on sign-out/sign-in, so one person's
/// bookings can never be shown to the next person on the same device.
void _watchAccount(Ref ref) => ref.watch(authStatusProvider);

/// The signed-in customer's own bookings.
class MyBookingsController extends AsyncNotifier<List<Booking>> {
  @override
  Future<List<Booking>> build() {
    _watchAccount(ref);
    final language = ref.watch(apiLanguageProvider);
    return ref.watch(bookingRepositoryProvider).listMine(language: language);
  }

  /// Replaces one booking in the list with its fresh state, e.g. after
  /// cancelling it from the detail screen. A booking not yet in the list
  /// (just created) is left for the next natural reload to pick up.
  void upsert(Booking booking) {
    final current = state.value;
    if (current == null) return;
    final index = current.indexWhere((b) => b.id == booking.id);
    if (index == -1) return;
    state = AsyncData([
      for (final b in current)
        if (b.id == booking.id) booking else b,
    ]);
  }
}

final myBookingsProvider =
    AsyncNotifierProvider.autoDispose<MyBookingsController, List<Booking>>(
      MyBookingsController.new,
      retry: noAutomaticRetry,
    );

/// The signed-in provider's assigned bookings.
class AssignedBookingsController extends AsyncNotifier<List<Booking>> {
  @override
  Future<List<Booking>> build() {
    _watchAccount(ref);
    final language = ref.watch(apiLanguageProvider);
    return ref
        .watch(bookingRepositoryProvider)
        .listAssigned(language: language);
  }
}

final assignedBookingsProvider =
    AsyncNotifierProvider.autoDispose<
      AssignedBookingsController,
      List<Booking>
    >(AssignedBookingsController.new, retry: noAutomaticRetry);

/// The signed-in provider's currently live dispatch offers (automatic
/// matching, not a browsable list of every open request).
class OpenBookingsController extends AsyncNotifier<List<Booking>> {
  @override
  Future<List<Booking>> build() {
    _watchAccount(ref);
    final language = ref.watch(apiLanguageProvider);
    return ref.watch(bookingRepositoryProvider).listOpen(language: language);
  }
}

final openBookingsProvider =
    AsyncNotifierProvider.autoDispose<OpenBookingsController, List<Booking>>(
      OpenBookingsController.new,
      retry: noAutomaticRetry,
    );

/// One booking, plus every action either side can take on it. Keyed by id so
/// several detail screens (unlikely, but cheap to support) stay independent.
class BookingDetailController extends AsyncNotifier<Booking> {
  BookingDetailController(this.bookingId);

  final String bookingId;

  @override
  Future<Booking> build() {
    _watchAccount(ref);
    final language = ref.watch(apiLanguageProvider);
    return ref
        .watch(bookingRepositoryProvider)
        .getBooking(bookingId, language: language);
  }

  String get _language => ref.read(apiLanguageProvider);
  BookingRepository get _repo => ref.read(bookingRepositoryProvider);

  /// Applies [updated] to this controller and to any list already holding
  /// this booking, so every screen showing it reflects the change at once.
  void _apply(Booking updated) {
    state = AsyncData(updated);
    ref.read(myBookingsProvider.notifier).upsert(updated);
    // Assigned/open lists change *membership* (a booking may join or leave
    // them), which a single upsert cannot express correctly, so those are
    // simply invalidated to reload.
    ref.invalidate(assignedBookingsProvider);
    ref.invalidate(openBookingsProvider);
  }

  Future<void> accept() async =>
      _apply(await _repo.accept(bookingId, language: _language));

  Future<void> decline() async =>
      _apply(await _repo.decline(bookingId, language: _language));

  Future<void> startEnRoute() async =>
      _apply(await _repo.startEnRoute(bookingId, language: _language));

  Future<void> markArrived() async =>
      _apply(await _repo.markArrived(bookingId, language: _language));

  Future<void> startWork() async =>
      _apply(await _repo.startWork(bookingId, language: _language));

  Future<void> complete() async =>
      _apply(await _repo.complete(bookingId, language: _language));

  Future<void> release(String reason) async =>
      _apply(await _repo.release(bookingId, reason, language: _language));

  Future<void> cancel(String reason) async =>
      _apply(await _repo.cancel(bookingId, reason, language: _language));

  Future<void> submitQuote({required double amount, String? note}) async =>
      _apply(
        await _repo.submitQuote(
          bookingId,
          amount: amount,
          note: note,
          language: _language,
        ),
      );

  Future<void> acceptQuote(String quoteId) async =>
      _apply(await _repo.acceptQuote(bookingId, quoteId, language: _language));

  Future<void> rejectQuote(String quoteId) async =>
      _apply(await _repo.rejectQuote(bookingId, quoteId, language: _language));
}

final bookingDetailProvider = AsyncNotifierProvider.autoDispose
    .family<BookingDetailController, Booking, String>(
      BookingDetailController.new,
      retry: noAutomaticRetry,
    );

/// Status filter for the booking history screen's tabs.
enum BookingHistoryTab { active, past }

const _activeStatuses = {
  BookingStatus.searching,
  BookingStatus.accepted,
  BookingStatus.enRoute,
  BookingStatus.arrived,
  BookingStatus.inProgress,
};

extension BookingHistoryTabFilter on BookingHistoryTab {
  bool matches(Booking booking) => switch (this) {
    BookingHistoryTab.active => _activeStatuses.contains(booking.status),
    BookingHistoryTab.past => !_activeStatuses.contains(booking.status),
  };
}
