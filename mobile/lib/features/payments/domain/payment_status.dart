/// A payment's lifecycle. Mirrors the backend's `payment_status` exactly
/// (already camelCase-compatible, so parsing goes through the shared
/// `readEnum` helper rather than a `fromWire` mapping like `BookingStatus`).
///
///   pending -> succeeded -> refunded
///   pending -> failed
///   pending -> cancelled
enum PaymentStatus { pending, succeeded, failed, cancelled, refunded }
