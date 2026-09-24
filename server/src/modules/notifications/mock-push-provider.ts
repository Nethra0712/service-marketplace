import type { Logger } from '../../lib/logger.js';
import type { PushMessage, PushProvider } from './push-provider.js';

/**
 * DEVELOPMENT AND TEST ONLY. Sends nothing and costs nothing.
 *
 * Keeps every message in memory (`sent`, used by tests) and, when given a
 * logger, prints it to the server log. Refused in production by
 * `loadEnv`/`createPushProvider`, the same way `MockSmsProvider` is.
 */
export class MockPushProvider implements PushProvider {
  readonly name = 'mock';
  readonly sent: PushMessage[] = [];

  constructor(private readonly logger?: Logger) {}

  send(message: PushMessage): Promise<void> {
    this.sent.push(message);
    this.logger?.info(
      { token: message.token, title: message.title },
      'MOCK PUSH (development only)',
    );
    return Promise.resolve();
  }

  /** The most recent message sent to `token`, or undefined. */
  lastMessageTo(token: string): PushMessage | undefined {
    return this.sent.findLast((message) => message.token === token);
  }
}
