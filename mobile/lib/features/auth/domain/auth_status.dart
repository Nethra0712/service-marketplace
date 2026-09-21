/// Where the app is in the sign-in lifecycle.
enum AuthStatus {
  /// App just started; a stored session (if any) is still being restored.
  unknown,

  /// No valid session. Only the sign-in screens are reachable.
  unauthenticated,

  /// A session exists. The signed-in part of the app is reachable.
  authenticated,
}
