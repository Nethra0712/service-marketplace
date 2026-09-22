import 'package:mobile/core/errors/app_exception.dart';

/// Returns [data] as a JSON object, or throws [UnknownException] if the server
/// answered with something unexpected (an HTML error page from a proxy, say).
Map<String, dynamic> asJsonObject(Object? data) {
  if (data is Map<String, dynamic>) return data;
  throw const UnknownException('Unexpected response from the server.');
}

/// Runs [parse] and converts a malformed payload (a missing field, a wrong
/// type, an unknown enum value) into [UnknownException], so callers only ever
/// have to handle [AppException]s.
T parseResponse<T>(T Function() parse) {
  try {
    return parse();
  } on FormatException catch (e) {
    throw UnknownException('Unexpected response from the server.', cause: e);
  } on TypeError catch (e) {
    throw UnknownException('Unexpected response from the server.', cause: e);
  }
}

/// The JSON objects in the list under [key] (an `items` array, say).
List<Map<String, dynamic>> readObjects(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! List<Object?>) {
    throw FormatException('"$key" is not a list.');
  }
  return [for (final item in value) asJsonObject(item)];
}

/// A required string field.
String readString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is String) return value;
  throw FormatException('"$key" is not a string.');
}

/// An optional string field: absent and `null` both give null.
String? readStringOrNull(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is String) return value;
  throw FormatException('"$key" is not a string.');
}

/// An optional whole-number field.
int? readIntOrNull(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is int) return value;
  throw FormatException('"$key" is not an integer.');
}

/// A required whole-number field.
int readInt(Map<String, dynamic> json, String key) =>
    readIntOrNull(json, key) ?? (throw FormatException('"$key" is missing.'));

/// An optional ISO-8601 timestamp.
DateTime? readDateTimeOrNull(Map<String, dynamic> json, String key) {
  final value = readStringOrNull(json, key);
  return value == null ? null : DateTime.parse(value);
}

/// The enum value named by the string at [key]. An unknown name (a newer
/// server than this app) is a [FormatException] rather than a silent default.
T readEnum<T extends Enum>(
  List<T> values,
  Map<String, dynamic> json,
  String key,
) {
  final name = readString(json, key);
  for (final value in values) {
    if (value.name == name) return value;
  }
  throw FormatException('"$key" has unknown value "$name".');
}
