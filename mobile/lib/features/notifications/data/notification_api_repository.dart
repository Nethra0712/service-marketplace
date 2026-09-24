import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/notifications/domain/device_platform.dart';
import 'package:mobile/features/notifications/domain/notification.dart';
import 'package:mobile/features/notifications/domain/notification_repository.dart';

/// [NotificationRepository] backed by the platform API.
class NotificationApiRepository implements NotificationRepository {
  NotificationApiRepository(this._api);

  final ApiClient _api;

  @override
  Future<void> registerToken(String token, DevicePlatform platform) =>
      _api.post(
        '/api/notifications/tokens',
        data: {'token': token, 'platform': platform.name},
      );

  @override
  Future<void> removeToken(String token) =>
      _api.delete('/api/notifications/tokens', data: {'token': token});

  @override
  Future<bool> getPushEnabled() async {
    final data = await _api.get('/api/notifications/preferences');
    return parseResponse(() => asJsonObject(data)['pushEnabled'] as bool);
  }

  @override
  Future<void> setPushEnabled(bool enabled) => _api.put(
    '/api/notifications/preferences',
    data: {'pushEnabled': enabled},
  );

  @override
  Future<NotificationFeed> listNotifications() async {
    final data = await _api.get('/api/notifications');
    return parseResponse(() {
      final json = asJsonObject(data);
      return NotificationFeed(
        items: [
          for (final item in readObjects(json, 'items'))
            AppNotification.fromJson(item),
        ],
        unreadCount: readInt(json, 'unreadCount'),
      );
    });
  }

  @override
  Future<void> markRead(String id) =>
      _api.post('/api/notifications/${Uri.encodeComponent(id)}/read');

  @override
  Future<void> markAllRead() => _api.post('/api/notifications/read-all');
}
