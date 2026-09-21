/// Calling code the phone field assumes, for the initial Sri Lankan launch.
/// (The server independently enforces which country codes are accepted.)
const defaultCallingCode = '94';

final _nonDigits = RegExp(r'[^\d]');
final _separators = RegExp(r'[\s\-().]');
final _nationalNumber = RegExp(r'^[1-9]\d{8}$');

/// Turns what a person typed into E.164 (`+94771234567`), or returns null if it
/// is not a plausible Sri Lankan number.
///
/// Accepts the ways people actually write it: `077 123 4567`, `0771234567`,
/// `771234567`, `94771234567`, `0094771234567`, `+94 77 123 4567`.
String? normalizeToE164(String input) {
  var text = input.trim().replaceAll(_separators, '');
  if (text.isEmpty) return null;

  var hadInternationalPrefix = false;
  if (text.startsWith('+')) {
    hadInternationalPrefix = true;
    text = text.substring(1);
  } else if (text.startsWith('00')) {
    hadInternationalPrefix = true;
    text = text.substring(2);
  }
  if (text.contains(_nonDigits)) return null;

  final String national;
  if (text.startsWith(defaultCallingCode) &&
      (hadInternationalPrefix ||
          text.length == defaultCallingCode.length + 9)) {
    national = text.substring(defaultCallingCode.length);
  } else if (hadInternationalPrefix) {
    return null; // A different country's number.
  } else if (text.startsWith('0')) {
    national = text.substring(1);
  } else {
    national = text;
  }

  return _nationalNumber.hasMatch(national)
      ? '+$defaultCallingCode$national'
      : null;
}

/// `+94771234567` becomes `+94 77 123 4567` for display. Anything unexpected is
/// returned unchanged.
String formatPhoneForDisplay(String e164) {
  final prefix = '+$defaultCallingCode';
  if (!e164.startsWith(prefix)) return e164;
  final national = e164.substring(prefix.length);
  if (national.length != 9) return e164;
  return '$prefix ${national.substring(0, 2)} '
      '${national.substring(2, 5)} ${national.substring(5)}';
}
