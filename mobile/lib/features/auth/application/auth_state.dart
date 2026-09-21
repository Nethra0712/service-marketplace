import 'package:mobile/features/auth/domain/auth_status.dart';
import 'package:mobile/features/auth/domain/current_user.dart';

/// What the UI needs to know about who is signed in.
class AuthState {
  const AuthState._(this.status, this.user);

  /// Startup: a stored session may exist but has not been checked yet.
  const AuthState.unknown() : this._(AuthStatus.unknown, null);

  const AuthState.unauthenticated() : this._(AuthStatus.unauthenticated, null);

  /// [user] is null until it has been loaded (or when the device is offline).
  const AuthState.authenticated([CurrentUser? user])
    : this._(AuthStatus.authenticated, user);

  final AuthStatus status;
  final CurrentUser? user;
}
