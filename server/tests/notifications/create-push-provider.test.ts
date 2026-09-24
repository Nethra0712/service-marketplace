import { describe, expect, it } from 'vitest';

import { createLogger } from '../../src/lib/logger.js';
import { createPushProvider } from '../../src/modules/notifications/create-push-provider.js';
import { MockPushProvider } from '../../src/modules/notifications/mock-push-provider.js';

const logger = createLogger({ logLevel: 'silent' });

describe('createPushProvider', () => {
  it('selects the mock provider outside production', () => {
    const provider = createPushProvider(
      { pushProvider: 'mock', nodeEnv: 'development', fcm: undefined },
      logger,
    );
    expect(provider).toBeInstanceOf(MockPushProvider);
  });

  it('refuses the mock provider in production', () => {
    expect(() =>
      createPushProvider({ pushProvider: 'mock', nodeEnv: 'production', fcm: undefined }, logger),
    ).toThrow(/production/);
  });

  it('refuses to select FCM without credentials, even outside production', () => {
    expect(() =>
      createPushProvider({ pushProvider: 'fcm', nodeEnv: 'development', fcm: undefined }, logger),
    ).toThrow(/FCM/);
  });
});
