import 'package:dio/dio.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/dio_error_mapper.dart';

/// Thin wrapper over [Dio] that returns decoded JSON and throws only
/// [AppException]s.
///
/// This is what repositories depend on. Widgets and notifiers never see it.
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  Future<Object?> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    CancelToken? cancelToken,
  }) => _send(
    () => _dio.get<Object?>(
      path,
      queryParameters: queryParameters,
      cancelToken: cancelToken,
    ),
  );

  Future<Object?> post(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    CancelToken? cancelToken,
  }) => _send(
    () => _dio.post<Object?>(
      path,
      data: data,
      queryParameters: queryParameters,
      cancelToken: cancelToken,
    ),
  );

  Future<Object?> put(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    CancelToken? cancelToken,
  }) => _send(
    () => _dio.put<Object?>(
      path,
      data: data,
      queryParameters: queryParameters,
      cancelToken: cancelToken,
    ),
  );

  Future<Object?> patch(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    CancelToken? cancelToken,
  }) => _send(
    () => _dio.patch<Object?>(
      path,
      data: data,
      queryParameters: queryParameters,
      cancelToken: cancelToken,
    ),
  );

  Future<Object?> delete(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    CancelToken? cancelToken,
  }) => _send(
    () => _dio.delete<Object?>(
      path,
      data: data,
      queryParameters: queryParameters,
      cancelToken: cancelToken,
    ),
  );

  Future<Object?> _send(Future<Response<Object?>> Function() request) async {
    try {
      final response = await request();
      return response.data;
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
