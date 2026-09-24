import 'package:flutter/material.dart';

/// A row of five stars: read-only for display, or interactive for input.
class StarRating extends StatelessWidget {
  const StarRating({
    required this.rating,
    this.interactive = false,
    this.onChanged,
    this.size = 28,
    super.key,
  });

  final int rating;
  final bool interactive;
  final ValueChanged<int>? onChanged;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 1; i <= 5; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1),
            child: interactive
                ? IconButton(
                    key: Key('star_$i'),
                    icon: Icon(
                      i <= rating ? Icons.star : Icons.star_border,
                      color: color,
                      size: size,
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    visualDensity: VisualDensity.compact,
                    onPressed: () => onChanged?.call(i),
                  )
                : Icon(
                    i <= rating ? Icons.star : Icons.star_border,
                    color: color,
                    size: size,
                  ),
          ),
      ],
    );
  }
}
