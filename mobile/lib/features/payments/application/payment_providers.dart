import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/network_providers.dart';
import 'package:mobile/core/utils/provider_retry.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/payments/data/payment_api_repository.dart';
import 'package:mobile/features/payments/domain/payment.dart';
import 'package:mobile/features/payments/domain/payment_repository.dart';

final paymentRepositoryProvider = Provider<PaymentRepository>(
  (ref) => PaymentApiRepository(ref.watch(apiClientProvider)),
);

void _watchAccount(Ref ref) => ref.watch(authStatusProvider);

/// One booking's current payment, for its customer or assigned provider.
/// Null while the booking has not been completed yet — a normal state, not
/// an error (see `PaymentRepository.getPayment`).
class BookingPaymentController extends AsyncNotifier<Payment?> {
  BookingPaymentController(this.bookingId);

  final String bookingId;

  @override
  Future<Payment?> build() {
    _watchAccount(ref);
    return ref.watch(paymentRepositoryProvider).getPayment(bookingId);
  }

  /// Starts (or resumes/retries) checkout, then refreshes the payment state
  /// so a caller who awaits this sees whatever changed (in practice nothing
  /// yet — the payment only actually changes once the gateway calls back).
  Future<CheckoutSession> createCheckout() async {
    final session = await ref
        .read(paymentRepositoryProvider)
        .createCheckout(bookingId);
    ref.invalidateSelf();
    return session;
  }
}

final bookingPaymentProvider = AsyncNotifierProvider.autoDispose
    .family<BookingPaymentController, Payment?, String>(
      BookingPaymentController.new,
      retry: noAutomaticRetry,
    );
