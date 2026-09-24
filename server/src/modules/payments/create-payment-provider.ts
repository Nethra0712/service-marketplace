import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../lib/logger.js';
import { MockPaymentProvider } from './mock-payment-provider.js';
import { PayHereProvider } from './payhere-payment-provider.js';
import type { PaymentProvider } from './payment-provider.js';

type PaymentConfig = Pick<AppConfig, 'paymentProvider' | 'nodeEnv' | 'payhere'>;

const factories: Record<
  PaymentConfig['paymentProvider'],
  (config: PaymentConfig, logger: Logger) => PaymentProvider
> = {
  mock: (config, logger) => {
    if (config.nodeEnv === 'production') {
      throw new Error('The mock payment provider cannot be used when NODE_ENV=production.');
    }
    return new MockPaymentProvider(logger);
  },
  payhere: (config) => {
    if (!config.payhere) {
      // loadEnv already requires PayHere credentials whenever PAYMENT_PROVIDER=payhere,
      // so this only happens if a caller builds AppConfig by hand, inconsistently.
      throw new Error(
        'PayHere is selected as the payment provider but no PayHere config was supplied.',
      );
    }
    return new PayHereProvider(config.payhere);
  },
};

export function createPaymentProvider(config: PaymentConfig, logger: Logger): PaymentProvider {
  return factories[config.paymentProvider](config, logger);
}
