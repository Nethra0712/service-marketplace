import type { Logger } from '../../lib/logger.js';
import type { SmsMessage, SmsProvider } from './sms-provider.js';

/**
 * DEVELOPMENT AND TEST ONLY. Sends nothing and costs nothing.
 *
 * It keeps every message in memory (`sent`, used by tests) and, when given a
 * logger, prints the message to the server log so a developer can read the OTP
 * from the console. Because it logs OTPs it must never run in production;
 * `loadEnv` and `createSmsProvider` both refuse to start it there.
 */
export class MockSmsProvider implements SmsProvider {
  readonly sent: SmsMessage[] = [];

  constructor(private readonly logger?: Logger) {}

  send(message: SmsMessage): Promise<void> {
    this.sent.push(message);
    this.logger?.info({ to: message.to, body: message.body }, 'MOCK SMS (development only)');
    return Promise.resolve();
  }

  /** The most recent message sent to `phone`, or undefined. */
  lastMessageTo(phone: string): SmsMessage | undefined {
    return this.sent.findLast((message) => message.to === phone);
  }

  /** Extracts the numeric code from the most recent message to `phone`. */
  lastCodeTo(phone: string): string | undefined {
    return /\b(\d{4,8})\b/.exec(this.lastMessageTo(phone)?.body ?? '')?.[1];
  }
}
