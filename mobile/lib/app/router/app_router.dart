import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/app/router/auth_redirect.dart';
import 'package:mobile/core/widgets/placeholder_screen.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';
import 'package:mobile/features/auth/presentation/otp_verification_screen.dart';
import 'package:mobile/features/auth/presentation/phone_entry_screen.dart';
import 'package:mobile/features/auth/presentation/splash_screen.dart';
import 'package:mobile/features/booking/presentation/booking_detail_screen.dart';
import 'package:mobile/features/booking/presentation/booking_history_screen.dart';
import 'package:mobile/features/booking/presentation/provider_jobs_screen.dart';
import 'package:mobile/features/booking/presentation/service_request_screen.dart';
import 'package:mobile/features/home/presentation/home_screen.dart';
import 'package:mobile/features/profile/presentation/profile_screen.dart';
import 'package:mobile/features/provider/presentation/provider_apply_screen.dart';
import 'package:mobile/features/provider/presentation/provider_hub_screen.dart';
import 'package:mobile/features/provider/presentation/provider_profile_screen.dart';
import 'package:mobile/features/provider/presentation/provider_services_screen.dart';
import 'package:mobile/features/services/presentation/service_detail_screen.dart';
import 'package:mobile/features/services/presentation/services_screen.dart';

/// The app's single [GoRouter]. All routes are declared here; access rules live
/// in [AppRoutes] and are applied by [resolveAuthRedirect].
final routerProvider = Provider<GoRouter>((ref) {
  // go_router re-evaluates `redirect` whenever this notifier changes, so
  // signing in, signing out, or a session expiring moves the user to the right
  // place automatically.
  final authListenable = ValueNotifier<AuthStatus>(
    ref.read(authStatusProvider),
  );
  ref.listen<AuthStatus>(
    authStatusProvider,
    (_, next) => authListenable.value = next,
  );
  ref.onDispose(authListenable.dispose);

  final router = GoRouter(
    initialLocation: AppRoutes.home.path,
    refreshListenable: authListenable,
    redirect: (context, state) => resolveAuthRedirect(
      status: ref.read(authStatusProvider),
      location: state.uri.toString(),
    ),
    routes: [
      GoRoute(
        name: AppRoutes.splash.name,
        path: AppRoutes.splash.path,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        name: AppRoutes.auth.name,
        path: AppRoutes.auth.path,
        builder: (context, state) => const PhoneEntryScreen(),
      ),
      GoRoute(
        name: AppRoutes.otp.name,
        path: AppRoutes.otp.path,
        builder: (context, state) => const OtpVerificationScreen(),
      ),
      GoRoute(
        name: AppRoutes.home.name,
        path: AppRoutes.home.path,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        name: AppRoutes.services.name,
        path: AppRoutes.services.path,
        builder: (context, state) => const ServicesScreen(),
      ),
      GoRoute(
        name: AppRoutes.serviceDetail.name,
        path: AppRoutes.serviceDetail.path,
        builder: (context, state) =>
            ServiceDetailScreen(slug: state.pathParameters['slug']!),
      ),
      GoRoute(
        name: AppRoutes.profile.name,
        path: AppRoutes.profile.path,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        name: AppRoutes.provider.name,
        path: AppRoutes.provider.path,
        builder: (context, state) => const ProviderHubScreen(),
      ),
      GoRoute(
        name: AppRoutes.providerProfile.name,
        path: AppRoutes.providerProfile.path,
        builder: (context, state) => const ProviderProfileScreen(),
      ),
      GoRoute(
        name: AppRoutes.providerServices.name,
        path: AppRoutes.providerServices.path,
        builder: (context, state) => const ProviderServicesScreen(),
      ),
      GoRoute(
        name: AppRoutes.providerApply.name,
        path: AppRoutes.providerApply.path,
        builder: (context, state) => ProviderApplyScreen(
          initialCategorySlug: state.uri.queryParameters['category'],
        ),
      ),
      GoRoute(
        name: AppRoutes.providerJobs.name,
        path: AppRoutes.providerJobs.path,
        builder: (context, state) => const ProviderJobsScreen(),
      ),
      GoRoute(
        name: AppRoutes.serviceRequest.name,
        path: AppRoutes.serviceRequest.path,
        builder: (context, state) =>
            ServiceRequestScreen(categorySlug: state.pathParameters['slug']!),
      ),
      GoRoute(
        name: AppRoutes.bookings.name,
        path: AppRoutes.bookings.path,
        builder: (context, state) => const BookingHistoryScreen(),
      ),
      GoRoute(
        name: AppRoutes.bookingDetail.name,
        path: AppRoutes.bookingDetail.path,
        builder: (context, state) =>
            BookingDetailScreen(bookingId: state.pathParameters['id']!),
      ),
    ],
    errorBuilder: (context, state) => PlaceholderScreen(
      title: AppLocalizations.of(context).pageNotFoundTitle,
    ),
  );
  ref.onDispose(router.dispose);
  return router;
});
