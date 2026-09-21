import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Source of "now". Injected wherever time matters (token expiry, resend
/// countdowns) so tests can move time without waiting.
typedef Clock = DateTime Function();

final clockProvider = Provider<Clock>((ref) => DateTime.now);
