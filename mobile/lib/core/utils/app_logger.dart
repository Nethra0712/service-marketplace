import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

/// Minimal logging facade. Logs only in non-release builds, so nothing is
/// written to the device log in production. Swap the body for a crash
/// reporter/logging backend later without touching call sites.
///
/// Never pass tokens, phone numbers, or other personal data to it.
abstract final class AppLogger {
  static void debug(String message, {String name = 'app'}) {
    if (kReleaseMode) return;
    developer.log(message, name: name);
  }

  static void error(
    String message, {
    String name = 'app',
    Object? error,
    StackTrace? stackTrace,
  }) {
    if (kReleaseMode) return;
    developer.log(
      message,
      name: name,
      level: 1000,
      error: error,
      stackTrace: stackTrace,
    );
  }
}
