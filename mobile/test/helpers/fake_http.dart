import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Answers requests in-process. No socket is ever opened.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;
  final List<RequestOptions> requests = [];

  /// The Authorization header each request carried *when it was sent*. Dio may
  /// later change the shared RequestOptions (e.g. to replay a request), so this
  /// is the reliable record.
  final List<String?> authorizations = [];

  RequestOptions? get lastRequest => requests.isEmpty ? null : requests.last;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    requests.add(options);
    authorizations.add(options.headers['Authorization']?.toString());
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

/// A JSON response with an optional status and headers.
ResponseBody jsonBody(
  Object? body, {
  int status = 200,
  Map<String, List<String>> headers = const {},
}) => ResponseBody.fromString(
  body == null ? '' : jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
    ...headers,
  },
);

/// The backend's standard error body: `{ "error": { "code", "message" } }`.
ResponseBody errorBody(
  int status,
  String code, {
  Map<String, List<String>> headers = const {},
}) => jsonBody(
  {
    'error': {'code': code, 'message': 'x', 'requestId': 'req-1'},
  },
  status: status,
  headers: headers,
);
