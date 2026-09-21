import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../lib/logger.js';
import { MockSmsProvider } from './mock-sms-provider.js';
import type { SmsProvider } from './sms-provider.js';

export { MockSmsProvider } from './mock-sms-provider.js';
export type { SmsMessage, SmsProvider } from './sms-provider.js';

type SmsConfig = Pick<AppConfig, 'smsProvider' | 'nodeEnv'>;

/**
 * One factory per value of `SMS_PROVIDER`. To add a real vendor: implement
 * `SmsProvider`, add its name to `SMS_PROVIDER` in `config/env.ts`, and add an
 * entry here. Nothing else in the application changes.
 */
const factories: Record<
  SmsConfig['smsProvider'],
  (config: SmsConfig, logger: Logger) => SmsProvider
> = {
  mock: (config, logger) => {
    // Second line of defence behind the env validation: the mock provider
    // logs OTPs and must never exist in a production process.
    if (config.nodeEnv === 'production') {
      throw new Error('The mock SMS provider cannot be used when NODE_ENV=production.');
    }
    return new MockSmsProvider(logger);
  },
};

export function createSmsProvider(config: SmsConfig, logger: Logger): SmsProvider {
  return factories[config.smsProvider](config, logger);
}
