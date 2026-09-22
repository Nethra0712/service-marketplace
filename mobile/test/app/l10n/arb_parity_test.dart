import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Reads an ARB file from disk: (translated strings, metadata by key).
({Map<String, String> strings, Map<String, Object?> meta}) _load(String lang) {
  final json = jsonDecode(
    File('lib/app/l10n/app_$lang.arb').readAsStringSync(),
  ) as Map<String, dynamic>;
  return (
    strings: {
      for (final e in json.entries)
        if (!e.key.startsWith('@') && e.value is String)
          e.key: e.value as String,
    },
    meta: {
      for (final e in json.entries)
        if (e.key.startsWith('@') && !e.key.startsWith('@@'))
          e.key.substring(1): e.value,
    },
  );
}

/// The `{name}` placeholders a message uses, ignoring plural/select syntax.
Set<String> _placeholders(String message) {
  // Inside `{count, plural, ...}` the first token is the variable.
  final names = <String>{};
  for (final match in RegExp(r'\{(\w+)(?:,|\})').allMatches(message)) {
    names.add(match.group(1)!);
  }
  return names;
}

void main() {
  final en = _load('en');
  final si = _load('si');
  final ta = _load('ta');

  for (final (code, lang) in [('si', si), ('ta', ta)]) {
    group('$code translation', () {
      test('defines exactly the same messages as English', () {
        expect(
          en.strings.keys.toSet().difference(lang.strings.keys.toSet()),
          isEmpty,
          reason: 'untranslated in $code',
        );
        expect(
          lang.strings.keys.toSet().difference(en.strings.keys.toSet()),
          isEmpty,
          reason: 'in $code but not in English',
        );
      });

      test('every message uses the same placeholders as English', () {
        for (final key in en.strings.keys) {
          expect(
            _placeholders(lang.strings[key]!),
            _placeholders(en.strings[key]!),
            reason: key,
          );
        }
      });

      test('no message is blank', () {
        for (final entry in lang.strings.entries) {
          expect(entry.value.trim(), isNotEmpty, reason: entry.key);
        }
      });

      test('is actually translated, not copied from English', () {
        // A phone-number example reads the same in every language.
        const sameEverywhere = {'authPhoneHint'};
        for (final entry in en.strings.entries) {
          if (sameEverywhere.contains(entry.key)) continue;
          expect(
            lang.strings[entry.key],
            isNot(entry.value),
            reason: '${entry.key} is still English in $code',
          );
        }
      });

      test('plural messages keep their plural forms', () {
        for (final key in en.strings.keys) {
          if (en.strings[key]!.contains(', plural,')) {
            expect(
              lang.strings[key],
              contains(', plural,'),
              reason: '$key lost its plural syntax in $code',
            );
          }
        }
      });
    });
  }

  test('every message with a placeholder documents it in English', () {
    for (final entry in en.strings.entries) {
      final names = _placeholders(entry.value);
      if (names.isEmpty) continue;
      final placeholders =
          (en.meta[entry.key] as Map<String, dynamic>?)?['placeholders']
              as Map<String, dynamic>?;
      expect(placeholders?.keys.toSet(), names, reason: entry.key);
    }
  });
}
