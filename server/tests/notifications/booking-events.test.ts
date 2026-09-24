import { describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider } from '../helpers/factories.js';
import { mustExist } from '../helpers/bookings.js';
import { completedBooking } from '../helpers/payments.js';
import { signInUser, type Api } from '../helpers/providers.js';

const handle = createTestDatabase();
const { db } = handle;

interface NotificationRow {
  kind: string;
  bookingId: string | null;
}
interface Feed {
  items: NotificationRow[];
  unreadCount: number;
}

async function kindsFor(api: Api): Promise<string[]> {
  const res = await api.get('/api/notifications');
  return (res.body as Feed).items.map((n) => n.kind);
}

describe('booking lifecycle events notify the other participant', () => {
  let t: TestApp;
  let catalogue: Catalogue;

  it('accept, en-route, arrived and completed all notify the customer (never the acting provider)', async () => {
    t = buildTestApp({ db });
    await resetDatabase(db);
    catalogue = await createCatalogue(db);

    const booking = await completedBooking(t, db, catalogue);

    const customerKinds = await kindsFor(booking.customer);
    expect(customerKinds).toEqual(
      expect.arrayContaining([
        'booking_accepted',
        'provider_en_route',
        'provider_arrived',
        'booking_completed',
      ]),
    );

    // The provider caused every one of these themselves: never notified about their own actions.
    const providerKinds = await kindsFor(booking.providerApi);
    expect(providerKinds).toEqual([]);
  });

  it('a customer cancellation notifies the assigned provider', async () => {
    t = buildTestApp({ db });
    await resetDatabase(db);
    catalogue = await createCatalogue(db);

    const { user } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);
    const { api: providerApi } = await signInUser(t.app, t.sms, user.phoneE164);
    const { api: customer } = await signInUser(t.app, t.sms);

    const created = await customer.post('/api/bookings', {
      categorySlug: 'cleaning',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Rd',
    });
    const bookingId = (created.body as { id: string }).id;
    await providerApi.post(`/api/bookings/${bookingId}/accept`);
    await customer.post(`/api/bookings/${bookingId}/cancel`, { reason: 'Changed my mind' });

    expect(await kindsFor(providerApi)).toEqual(['booking_cancelled']);
    // The customer was notified about the provider's accept (not their own
    // later cancellation, which they themselves caused).
    expect(await kindsFor(customer)).toEqual(['booking_accepted']);
  });

  it('a quote submission notifies the customer; accepting/rejecting it notifies the quoting provider', async () => {
    t = buildTestApp({ db });
    await resetDatabase(db);
    catalogue = await createCatalogue(db);

    const { user: providerUser } = await createApprovedProvider(
      db,
      catalogue.plumbing,
      catalogue.colombo,
    );
    const { api: providerApi } = await signInUser(t.app, t.sms, providerUser.phoneE164);
    const { api: customer } = await signInUser(t.app, t.sms);

    const created = await customer.post('/api/bookings', {
      categorySlug: 'plumbing',
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '1 Test Rd',
    });
    const bookingId = (created.body as { id: string }).id;

    await providerApi.post(`/api/bookings/${bookingId}/quotes`, { amount: 3000 });
    expect(await kindsFor(customer)).toEqual(['quote_created']);

    const withQuote = await customer.get(`/api/bookings/${bookingId}`);
    const quotes = (withQuote.body as { quotes: { id: string }[] }).quotes;
    const quoteId = mustExist(quotes[0], 'a submitted quote').id;
    await customer.post(`/api/bookings/${bookingId}/quotes/${quoteId}/accept`);

    expect(await kindsFor(providerApi)).toEqual(['quote_accepted']);
  });
});
