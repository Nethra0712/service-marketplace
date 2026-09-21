import 'package:flutter/material.dart';

/// Shown briefly at launch while a stored session is being checked, so the app
/// does not flash the sign-in screen at someone who is already signed in.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}
