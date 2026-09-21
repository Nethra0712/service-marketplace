import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';

/// Placeholder: authentication is not implemented yet, so the user is always
/// signed out. The router already reacts to this provider, so replacing it with
/// a real session notifier requires no router changes.
final authStatusProvider = Provider<AuthStatus>(
  (ref) => AuthStatus.unauthenticated,
);
