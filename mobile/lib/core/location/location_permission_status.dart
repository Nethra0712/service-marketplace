/// Every state location access can be in. Never assume `granted`: always
/// check first, and be ready to show a sensible view for each of the rest.
enum LocationPermissionStatus {
  /// The app may read the device's location right now.
  granted,

  /// Not granted yet, but asking again is worth trying (the person has not
  /// permanently refused).
  denied,

  /// Refused in a way the OS will not ask about again; only the system
  /// settings screen can change it.
  deniedForever,

  /// The OS location service itself (GPS/network location) is switched off,
  /// independent of whether this app has permission.
  serviceDisabled;

  bool get isGranted => this == LocationPermissionStatus.granted;
}
