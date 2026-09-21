import 'package:dio/dio.dart';
import 'package:mobile/core/utils/app_logger.dart';

/// Development-only request logging.
///
/// Deliberately logs just method, path, status and duration. Headers
/// (Authorization), query strings and bodies can contain credentials or
/// personal data and are never logged.
class LoggingInterceptor extends Interceptor {
  static const _startKey = 'log_started_at';
  static const _name = 'http';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.extra[_startKey] = DateTime.now().millisecondsSinceEpoch;
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    AppLogger.debug(
      '${response.requestOptions.method} ${response.requestOptions.uri.path} '
      '-> ${response.statusCode} (${_elapsedMs(response.requestOptions)} ms)',
      name: _name,
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    AppLogger.debug(
      '${err.requestOptions.method} ${err.requestOptions.uri.path} '
      '-> ${err.response?.statusCode ?? err.type.name} '
      '(${_elapsedMs(err.requestOptions)} ms)',
      name: _name,
    );
    handler.next(err);
  }

  int _elapsedMs(RequestOptions options) {
    final started = options.extra[_startKey];
    if (started is! int) return 0;
    return DateTime.now().millisecondsSinceEpoch - started;
  }
}
