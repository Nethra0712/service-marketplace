export interface SmsMessage {
  /** Recipient in E.164 format, e.g. +94771234567. */
  to: string;
  body: string;
}

/**
 * The only thing the rest of the application knows about SMS delivery.
 *
 * A real vendor (chosen before production) is added by implementing this
 * interface and registering it in `createSmsProvider`. Nothing else changes.
 * `send` must reject if the message could not be handed to the vendor.
 */
export interface SmsProvider {
  send: (message: SmsMessage) => Promise<void>;
}
