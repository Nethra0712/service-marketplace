import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/notifications/domain/notification_kind.dart';

/// One durable, in-app notification record. The title/body arrive already
/// composed (and already in the recipient's own language) from the server —
/// see `notification-copy.ts`'s doc comment on why that is computed
/// server-side rather than re-localized here.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    required this.createdAt,
    this.bookingId,
    this.paymentId,
    this.payoutId,
    this.readAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: readString(json, 'id'),
        kind: NotificationKind.fromWire(readString(json, 'kind')),
        title: readString(json, 'title'),
        body: readString(json, 'body'),
        bookingId: readStringOrNull(json, 'bookingId'),
        paymentId: readStringOrNull(json, 'paymentId'),
        payoutId: readStringOrNull(json, 'payoutId'),
        readAt: readDateTimeOrNull(json, 'readAt'),
        createdAt: DateTime.parse(readString(json, 'createdAt')),
      );

  final String id;
  final NotificationKind kind;
  final String title;
  final String body;
  final String? bookingId;
  final String? paymentId;
  final String? payoutId;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isUnread => readAt == null;
}
