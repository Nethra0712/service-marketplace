import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';

/// The current sign-in status. The router watches this (and only this), so it
/// stays independent of how sessions are stored or refreshed.
final authStatusProvider = Provider<AuthStatus>(
  (ref) => ref.watch(authControllerProvider.select((state) => state.status)),
);
