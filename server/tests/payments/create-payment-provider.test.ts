import { describe, expect, it } from 'vitest';

import { createPaymentProvider } from '../../src/modules/payments/create-payment-provider.js';
import { MockPaymentProvider } from '../../src/modules/payments/mock-payment-provider.js';
import { PayHereProvider } from '../../src/modules/payments/payhere-payment-provider.js';
import { createLogger } from '../../src/lib/logger.js';

const logger = createLogger({ logLevel: 'silent' });

describe('createPaymentProvider', () => {
  it('selects the mock provider outside production', () => {
    const provider = createPaymentProvider(
      { paymentProvider: 'mock', nodeEnv: 'development', payhere: undefined },
      logger,
    );
    expect(provider).toBeInstanceOf(MockPaymentProvider);
  });

  it('refuses the mock provider in production', () => {
    expect(() =>
      createPaymentProvider(
        { paymentProvider: 'mock', nodeEnv: 'production', payhere: undefined },
        logger,
      ),
    ).toThrow(/production/);
  });

  it('selects PayHere when configured, using the supplied credentials', () => {
    const payhere = { merchantId: 'M1', merchantSecret: 's', mode: 'sandbox' as const };
    const provider = createPaymentProvider(
      { paymentProvider: 'payhere', nodeEnv: 'production', payhere },
      logger,
    );
    expect(provider).toBeInstanceOf(PayHereProvider);
  });

  it('refuses to select PayHere without credentials, even outside production', () => {
    expect(() =>
      createPaymentProvider(
        { paymentProvider: 'payhere', nodeEnv: 'development', payhere: undefined },
        logger,
      ),
    ).toThrow(/PayHere/);
  });
});
