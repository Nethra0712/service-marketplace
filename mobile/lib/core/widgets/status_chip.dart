import 'package:flutter/material.dart';

/// A status pill. The state is carried by an icon and a word, never by colour
/// alone, so it reads correctly for colour-blind users.
class StatusChip extends StatelessWidget {
  const StatusChip({
    required this.label,
    required this.icon,
    required this.tone,
    super.key,
  });

  final String label;
  final IconData icon;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (background, foreground) = switch (tone) {
      StatusTone.good => (scheme.primaryContainer, scheme.onPrimaryContainer),
      StatusTone.bad => (scheme.errorContainer, scheme.onErrorContainer),
      StatusTone.neutral => (
        scheme.surfaceContainerHighest,
        scheme.onSurfaceVariant,
      ),
    };
    return Chip(
      avatar: Icon(icon, size: 18, color: foreground),
      label: Text(label, style: TextStyle(color: foreground)),
      backgroundColor: background,
      side: BorderSide.none,
      visualDensity: VisualDensity.compact,
    );
  }
}

/// Whether a status reads as a success, a failure, or neither.
enum StatusTone { good, bad, neutral }
