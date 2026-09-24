import type { Database } from '../../src/db/client.js';
import type { CheckoutSession } from '../../src/modules/payments/payment-provider.js';
import type { PaymentView } from '../../src/modules/payments/payments.service.js';
import { bookingOf } from './bookings.js';
import type { Catalogue } from './catalogue.js';
import { createApprovedProvider } from './factories.js';
import { signInUser, type Api } from './providers.js';
import type { TestApp } from './app.js';

/** A checkout response body, typed instead of `any`. */
export const checkoutOf = (res: { body: unknown }): CheckoutSession => res.body as CheckoutSession;

/** A payment response body, typed instead of `any`. */
export const paymentOf = (res: { body: unknown }): PaymentView => res.body as PaymentView;

export interface CompletedBooking {
  bookingId: string;
  customer: Api;
  providerApi: Api;
  providerProfileId: string;
  providerPhone: string;
  /** The booking's final, settled price: 1500.00/hour * 10 minutes = 250.00. */
  agreedAmount: string;
}

/**
 * Walks an hourly-priced (`cleaning`, LKR 1500.00/hour) booking all the way
 * to `completed` over real HTTP, exactly as a customer and provider would,
 * so payment tests exercise a booking whose price was genuinely settled by
 * `bookings.service.ts`, not inserted directly. The clock only advances 10
 * minutes — comfortably inside the access token's TTL — giving a clean,
 * predictable `agreedAmount` of 250.00.
 *
 * Pass `provider` (from an earlier call's `providerPhone`/`providerProfileId`)
 * to assign a SECOND booking to the SAME provider, e.g. to test summing
 * several payments for one provider in a payout period. A fresh access token
 * is signed in for them either way, since reusing one across two calls (each
 * advancing the clock 10 minutes) could otherwise outlive its TTL.
 */
export async function completedBooking(
  t: TestApp,
  db: Database,
  catalogue: Catalogue,
  existingProvider?: { phone: string; profileId: string },
): Promise<CompletedBooking> {
  const { api: customer } = await signInUser(t.app, t.sms);
  const providerIdentity =
    existingProvider ??
    (await (async () => {
      const { user, profile } = await createApprovedProvider(
        db,
        catalogue.cleaning,
        catalogue.colombo,
      );
      return { phone: user.phoneE164, profileId: profile.id };
    })());
  const { api: providerApi } = await signInUser(t.app, t.sms, providerIdentity.phone);
  const provider = {
    api: providerApi,
    profileId: providerIdentity.profileId,
    phone: providerIdentity.phone,
  };

  const created = await customer.post('/api/bookings', {
    categorySlug: 'cleaning',
    citySlug: 'colombo',
    bookingType: 'on_demand',
    serviceAddress: '12 Galle Road, Colombo 03',
  });
  const bookingId = (created.body as { id: string }).id;

  await provider.api.post(`/api/bookings/${bookingId}/accept`);
  await provider.api.post(`/api/bookings/${bookingId}/en-route`);
  await provider.api.post(`/api/bookings/${bookingId}/arrived`);
  await provider.api.post(`/api/bookings/${bookingId}/start`);
  t.clock.advanceSeconds(600);
  const completed = await provider.api.post(`/api/bookings/${bookingId}/complete`);

  return {
    bookingId,
    customer,
    providerApi: provider.api,
    providerProfileId: provider.profileId,
    providerPhone: provider.phone,
    agreedAmount: bookingOf(completed).agreedAmount ?? '0.00',
  };
}
