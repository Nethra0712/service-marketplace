import 'dart:async';

import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/utils/clock.dart';
import 'package:mobile/features/auth/data/session_store.dart';
import 'package:mobile/features/auth/domain/auth_repository.dart';
import 'package:mobile/features/auth/domain/auth_session.dart';

/// Things that happen to the session outside the user's control.
enum SessionEvent {
  /// The server rejected the refresh token, so the session is over.
  expired,
}

/// Owns the current session's credentials: keeps them in memory and in secure
/// storage, hands out the access token, renews it, and ends the session.
///
/// It is deliberately independent of Riverpod widgets and UI state (it holds
/// tokens, nothing else), so the HTTP layer can depend on it without knowing
/// anything about screens.
class SessionManager {
  SessionManager({
    required this._store,
    required this._repository,
    required this._now,
  });

  final SessionStore _store;
  final AuthRepository _repository;
  final Clock _now;

  final _events = StreamController<SessionEvent>.broadcast();
  AuthSession? _session;
  Future<bool>? _refreshInFlight;

  Stream<SessionEvent> get events => _events.stream;

  /// Whether a session is currently held.
  bool get hasSession => _session != null;

  /// Loads a previously saved session. Returns null (and clears storage) if
  /// there is none, or if its refresh token has already expired.
  Future<AuthSession?> restore() async {
    final AuthSession? stored;
    try {
      stored = await _store.read();
    } on AppException {
      return null; // Unreadable keystore: behave as signed out.
    }
    if (stored == null) return null;

    if (stored.isRefreshTokenExpired(_now())) {
      await _clearStorage();
      return null;
    }
    _session = stored;
    return stored;
  }

  /// Begins a new session (after a successful OTP verification).
  Future<void> start(AuthSession session) async {
    _session = session;
    await _store.write(session);
  }

  /// The access token to send, refreshing it first if it is about to expire.
  /// Returns null when signed out.
  Future<String?> readAccessToken() async {
    final session = _session;
    if (session == null) return null;
    if (session.isAccessTokenExpiring(_now())) {
      await refresh();
    }
    return _session?.accessToken;
  }

  /// Renews the session's tokens. Returns true on success.
  ///
  /// Concurrent callers share one network call. That matters: refresh tokens
  /// are single-use, so two simultaneous refreshes with the same token would
  /// make the second look like token theft and end the session.
  Future<bool> refresh() {
    return _refreshInFlight ??= _refreshOnce().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _refreshOnce() async {
    final session = _session;
    if (session == null) return false;

    try {
      final renewed = await _repository.refresh(session.refreshToken);
      // The user may have signed out (or signed in as someone else) while the
      // request was in flight. Never resurrect a session they just ended.
      if (!identical(_session, session)) return false;
      _session = renewed;
      await _store.write(renewed);
      return true;
    } on UnauthorizedException {
      // The server no longer recognises this session (expired, revoked, or
      // reuse detected). Nothing can be recovered locally.
      if (!identical(_session, session)) return false;
      _session = null;
      await _clearStorage();
      _events.add(SessionEvent.expired);
      return false;
    } on AppException {
      // Offline, timeout, server hiccup: keep the session and try again later.
      return false;
    }
  }

  /// Ends the session. The device forgets its credentials immediately; telling
  /// the server is best effort, so signing out works with no connection.
  Future<void> end() async {
    final session = _session;
    _session = null;
    await _clearStorage();
    if (session == null) return;

    try {
      await _repository.logout(session.refreshToken);
    } on AppException {
      // The server will expire the session on its own.
    }
  }

  Future<void> _clearStorage() async {
    try {
      await _store.clear();
    } on AppException {
      // Nothing more we can do; the in-memory copy is already gone.
    }
  }

  void dispose() {
    unawaited(_events.close());
  }
}
