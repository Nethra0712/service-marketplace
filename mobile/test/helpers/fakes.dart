import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/config/app_environment.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/maps/app_map.dart';
import 'package:mobile/core/storage/secure_storage.dart';
import 'package:mobile/core/utils/clock.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/domain/auth_repository.dart';
import 'package:mobile/features/auth/domain/auth_session.dart';
import 'package:mobile/features/auth/domain/current_user.dart';
import 'package:mobile/features/auth/domain/otp_challenge.dart';
import 'package:mobile/features/notifications/application/notification_providers.dart';
import 'package:mobile/features/notifications/data/noop_push_notification_service.dart';
import 'package:mobile/features/notifications/domain/notification_repository.dart';
import 'package:mobile/features/notifications/domain/push_notification_service.dart';

import 'fake_tile_provider.dart';
import 'notification_fakes.dart';

/// Secure storage that lives in memory, so tests never touch a platform channel.
class InMemorySecureStorage implements SecureStorage {
  final Map<String, String> values = {};

  /// Make every operation fail, as a corrupted keystore would.
  bool failing = false;

  void _check() {
    if (failing) throw const StorageException('keystore unavailable');
  }

  @override
  Future<String?> read(String key) async {
    _check();
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    _check();
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    _check();
    values.remove(key);
  }

  @override
  Future<void> deleteAll() async {
    _check();
    values.clear();
  }
}

/// A clock tests can move forward.
class TestClock {
  TestClock([DateTime? start]) : now = start ?? DateTime.utc(2026, 1, 1, 12);

  DateTime now;

  DateTime call() => now;

  void advance(Duration duration) => now = now.add(duration);
}

/// A session created at [now] with the server's default lifetimes.
AuthSession makeSession(
  DateTime now, {
  String tag = '1',
  Duration accessTtl = const Duration(minutes: 15),
  Duration refreshTtl = const Duration(days: 30),
}) => AuthSession(
  accessToken: 'access-$tag',
  accessTokenExpiresAt: now.add(accessTtl),
  refreshToken: 'refresh-$tag',
  refreshTokenExpiresAt: now.add(refreshTtl),
);

const testUser = CurrentUser(
  id: 'user-1',
  phone: '+94771234567',
  roles: ['customer'],
);

/// A scriptable [AuthRepository]. By default every call succeeds; assign a
/// handler to make a call fail or take time.
class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository(this.clock);

  final TestClock clock;

  Future<OtpChallenge> Function(String phone)? onRequestOtp;
  Future<AuthSession> Function(String challengeId, String code)? onVerifyOtp;
  Future<AuthSession> Function(String refreshToken)? onRefresh;
  Future<void> Function(String refreshToken)? onLogout;

  final requestedPhones = <String>[];
  final verifyCalls = <({String challengeId, String code})>[];
  final refreshCalls = <String>[];
  final logoutCalls = <String>[];

  var _counter = 0;

  @override
  Future<OtpChallenge> requestOtp(String phoneE164) async {
    requestedPhones.add(phoneE164);
    final handler = onRequestOtp;
    if (handler != null) return handler(phoneE164);
    _counter += 1;
    return OtpChallenge(
      challengeId: 'challenge-$_counter',
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
    );
  }

  @override
  Future<AuthSession> verifyOtp({
    required String challengeId,
    required String code,
  }) async {
    verifyCalls.add((challengeId: challengeId, code: code));
    final handler = onVerifyOtp;
    if (handler != null) return handler(challengeId, code);
    return makeSession(clock.now, tag: 'signin');
  }

  @override
  Future<AuthSession> refresh(String refreshToken) async {
    refreshCalls.add(refreshToken);
    final handler = onRefresh;
    if (handler != null) return handler(refreshToken);
    return makeSession(clock.now, tag: 'refreshed-${refreshCalls.length}');
  }

  @override
  Future<void> logout(String refreshToken) async {
    logoutCalls.add(refreshToken);
    final handler = onLogout;
    if (handler != null) return handler(refreshToken);
  }
}

class FakeCurrentUserRepository implements CurrentUserRepository {
  Future<CurrentUser> Function()? onFetch;
  int calls = 0;

  @override
  Future<CurrentUser> fetchCurrentUser() async {
    calls += 1;
    final handler = onFetch;
    return handler == null ? testUser : handler();
  }
}

/// Everything a test needs, wired into one container.
class AuthHarness {
  AuthHarness({
    DateTime? start,
    InMemorySecureStorage? storage,
    NotificationRepository? notification,
    PushNotificationService? push,
    this.extraOverrides = const [],
  }) : clock = TestClock(start),
       storage = storage ?? InMemorySecureStorage(),
       notification = notification ?? FakeNotificationRepository(),
       push = push ?? const NoopPushNotificationService() {
    auth = FakeAuthRepository(clock);
    users = FakeCurrentUserRepository();
    container = ProviderContainer(overrides: overrides);
  }

  final TestClock clock;
  final InMemorySecureStorage storage;
  // Every screen watches these (the app bar's bell, the home screen's
  // permission banner), not just notification screens, so they must always
  // be overridden with SOMETHING safe — never real I/O — even for a test
  // that never mentions notifications. `FeatureHarness` supplies its own
  // inspectable fakes here instead of layering a second override in
  // `extraOverrides`, which Riverpod refuses (one override per provider).
  final NotificationRepository notification;
  final PushNotificationService push;

  /// Extra overrides (feature repositories, usually) applied on top of the
  /// auth fakes.
  final List<Override> extraOverrides;
  late final FakeAuthRepository auth;
  late final FakeCurrentUserRepository users;
  late final ProviderContainer container;

  static const config = AppConfig(
    environment: AppEnvironment.dev,
    apiBaseUrl: 'http://localhost:3000',
    enableNetworkLogging: false,
  );

  /// The overrides that replace all real I/O. Reused by widget tests.
  List<Override> get overrides => [
    appConfigProvider.overrideWithValue(config),
    secureStorageProvider.overrideWithValue(storage),
    authRepositoryProvider.overrideWithValue(auth),
    currentUserRepositoryProvider.overrideWithValue(users),
    clockProvider.overrideWithValue(clock.call),
    // Never let a widget test render a real map tile over the network.
    appMapTileProviderOverrideProvider.overrideWithValue(FakeTileProvider()),
    notificationRepositoryProvider.overrideWithValue(notification),
    pushNotificationServiceProvider.overrideWithValue(push),
    ...extraOverrides,
  ];

  void dispose() => container.dispose();
}
