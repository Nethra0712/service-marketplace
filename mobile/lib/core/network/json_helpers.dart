import 'package:mobile/core/errors/app_exception.dart';

/// Returns [data] as a JSON object, or throws [UnknownException] if the server
/// answered with something unexpected (an HTML error page from a proxy, say).
Map<String, dynamic> asJsonObject(Object? data) {
  if (data is Map<String, dynamic>) return data;
  throw const UnknownException('Unexpected response from the server.');
}
