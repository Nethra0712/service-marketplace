import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/application/auth_state.dart';
import 'package:mobile/features/auth/application/session_manager.dart';
import 'package:mobile/features/auth/domain/auth_session.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';

/// The app's single source of truth for "is anyone signed in?".
///
/// Widgets and the router read this; they never touch tokens or the network.
class AuthController extends Notifier<AuthState> {
  /// Completes once the stored session (if any) has been checked. The UI never
  /// waits on it (it just shows the splash while the state is `unknown`), but
  /// tests can.
  late final Future<void> ready = _restore();

  @override
  AuthState build() {
    final manager = ref.watch(sessionManagerProvider);

    // The session can end without the user asking (the server rejected our
    // refresh token). Reflect that immediately so the router sends them to sign in.
    final subscription = manager.events.listen((event) {
      if (event == SessionEvent.expired) {
        state = const AuthState.unauthenticated();
      }
    });
    ref.onDispose(subscription.cancel);

    unawaited(ready);
    return const AuthState.unknown();
  }

  /// Signs in with the credentials from a verified OTP.
  Future<void> signIn(AuthSession session) async {
    await ref.read(sessionManagerProvider).start(session);
    state = const AuthState.authenticated();
    await _loadUser();
  }

  /// Signs out. The UI flips to signed-out immediately; the server is told in
  /// the background and a failure to reach it never blocks signing out.
  Future<void> logout() async {
    final remoteDone = ref.read(sessionManagerProvider).end();
    state = const AuthState.unauthenticated();
    await remoteDone;
  }

  Future<void> _restore() async {
    final session = await ref.read(sessionManagerProvider).restore();
    // Someone signed in (or out) while we were reading storage: their result wins.
    if (state.status != AuthStatus.unknown) return;
    if (session == null) {
      state = const AuthState.unauthenticated();
      return;
    }
    // Optimistically signed in: the credentials are on the device. Loading the
    // user then confirms with the server (refreshing the token if needed).
    await _loadUser();
  }

  /// Fetches the user and drops the session if the server refuses it. Being
  /// offline is not a reason to sign the person out.
  Future<void> _loadUser() async {
    try {
      final user = await ref
          .read(currentUserRepositoryProvider)
          .fetchCurrentUser();
      state = AuthState.authenticated(user);
    } on UnauthorizedException {
      await _endSession();
    } on ForbiddenException {
      await _endSession(); // e.g. account suspended
    } on AppException {
      state = const AuthState.authenticated();
    }
  }

  Future<void> _endSession() async {
    final remoteDone = ref.read(sessionManagerProvider).end();
    state = const AuthState.unauthenticated();
    await remoteDone;
  }
}
