import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../lib/logger.js';
import { FcmPushProvider } from './fcm-push-provider.js';
import { MockPushProvider } from './mock-push-provider.js';
import type { PushProvider } from './push-provider.js';

type PushConfig = Pick<AppConfig, 'pushProvider' | 'nodeEnv' | 'fcm'>;

const factories: Record<
  PushConfig['pushProvider'],
  (config: PushConfig, logger: Logger) => PushProvider
> = {
  mock: (config, logger) => {
    if (config.nodeEnv === 'production') {
      throw new Error('The mock push provider cannot be used when NODE_ENV=production.');
    }
    return new MockPushProvider(logger);
  },
  fcm: (config) => {
    if (!config.fcm) {
      // loadEnv already requires FCM credentials whenever PUSH_PROVIDER=fcm,
      // so this only happens if a caller builds AppConfig by hand, inconsistently.
      throw new Error('FCM is selected as the push provider but no FCM config was supplied.');
    }
    return new FcmPushProvider(config.fcm);
  },
};

export function createPushProvider(config: PushConfig, logger: Logger): PushProvider {
  return factories[config.pushProvider](config, logger);
}
