import 'package:flutter/widgets.dart';

/// Spacing scale (logical pixels). Use these instead of magic numbers.
abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;

  /// Default padding around a screen's content.
  static const EdgeInsets screen = EdgeInsets.all(md);
}

/// Corner radii.
abstract final class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
}
