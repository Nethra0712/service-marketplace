import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/domain/phone_number.dart';

void main() {
  group('normalizeToE164', () {
    test('accepts the ways Sri Lankan numbers are actually written', () {
      const inputs = [
        '771234567',
        '0771234567',
        '077 123 4567',
        '077-123-4567',
        '(077) 123 4567',
        '94771234567',
        '+94771234567',
        '+94 77 123 4567',
        '0094771234567',
        '  0771234567  ',
      ];
      for (final input in inputs) {
        expect(normalizeToE164(input), '+94771234567', reason: input);
      }
    });

    test('accepts landline-style national numbers too', () {
      expect(normalizeToE164('011 234 5678'), '+94112345678');
    });

    test('rejects input that is not a plausible number', () {
      const inputs = [
        '',
        '   ',
        'abc',
        '77 123 45', // too short
        '07712345678', // too long
        '0771234567890',
        '+9477abc4567',
        '077-123-456x',
        '0',
        '+',
        '+94',
        '94',
      ];
      for (final input in inputs) {
        expect(normalizeToE164(input), isNull, reason: 'input "$input"');
      }
    });

    test('rejects numbers from other countries', () {
      expect(normalizeToE164('+14155550100'), isNull);
      expect(normalizeToE164('+919876543210'), isNull);
      expect(normalizeToE164('0014155550100'), isNull);
    });

    test('always returns the strict format the server requires', () {
      final result = normalizeToE164('0712345678');
      expect(result, matches(RegExp(r'^\+94[1-9]\d{8}$')));
    });
  });

  group('formatPhoneForDisplay', () {
    test('groups a Sri Lankan number for reading', () {
      expect(formatPhoneForDisplay('+94771234567'), '+94 77 123 4567');
    });

    test('leaves anything unexpected untouched', () {
      expect(formatPhoneForDisplay(''), '');
      expect(formatPhoneForDisplay('+14155550100'), '+14155550100');
      expect(formatPhoneForDisplay('+94123'), '+94123');
    });
  });
}
