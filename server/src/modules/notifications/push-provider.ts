/** One push message to one device token. */
export interface PushMessage {
  token: string;
  title: string;
  body: string;
  /** Small string-only payload for deep-linking, e.g. `{ bookingId: '...' }`. */
  data?: Record<string, string>;
}

/**
 * The only thing the rest of the application knows about push delivery.
 *
 * A real vendor (Firebase Cloud Messaging today) is added by implementing
 * this interface and registering it in `createPushProvider`. Nothing else
 * changes. `send` must reject if the message could not be handed to the
 * vendor; callers send to one token at a time and are expected to catch and
 * log a single token's failure without letting it stop delivery to a
 * recipient's other devices — see `notifications.service.ts`'s `notify`.
 */
export interface PushProvider {
  readonly name: 'mock' | 'fcm';
  send: (message: PushMessage) => Promise<void>;
}
