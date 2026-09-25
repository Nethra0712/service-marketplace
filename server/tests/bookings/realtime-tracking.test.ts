import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { MATCHING_WINDOW_MS } from '../../src/modules/bookings/bookings.service.js';
import { buildTestApp, type TestApp } from '../helpers/app.js';
import { createCatalogue, type Catalogue } from '../helpers/catalogue.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import { createApprovedProvider } from '../helpers/factories.js';
import { signInUser, type Api } from '../helpers/providers.js';

/**
 * Proves the wiring from a booking's terminal transitions through to the
 * realtime module's cache eviction (see `app.ts`'s `onRealtimeReady` and
 * `bookings.service.ts`'s `onBookingEnded`) — not the realtime module's own
 * authorization/rate-limit behaviour, which `tests/realtime/location.test.ts`
 * already covers. A socket-level test can't distinguish "cleared proactively
 * at the moment the booking ended" from "cleared lazily the next time
 * someone joins," since both look identical from a client's perspective —
 * this test observes the hook call directly instead.
 */
const handle = createTestDatabase();
const { db } = handle;

let t: TestApp;
let catalogue: Catalogue;
let customer: Api;
let customerPhone: string;
let forgetBooking: Mock<(bookingId: string) => void>;

beforeEach(async () => {
  await resetDatabase(db);
  catalogue = await createCatalogue(db);
  t = buildTestApp({ db });
  forgetBooking = vi.fn<(bookingId: string) => void>();
  t.onRealtimeReady(forgetBooking);
  ({ api: customer, phone: customerPhone } = await signInUser(t.app, t.sms));
});
afterAll(() => handle.close());

async function acceptedBooking(categorySlug = 'cleaning') {
  const { user } = await createApprovedProvider(db, catalogue.cleaning, catalogue.colombo);
  const provider = await signInUser(t.app, t.sms, user.phoneE164);
  const created = await customer.post('/api/bookings', {
    categorySlug,
    citySlug: 'colombo',
    bookingType: 'on_demand',
    serviceAddress: '12 Galle Road',
  });
  expect(created.status).toBe(201);
  const bookingId = (created.body as { id: string }).id;
  const accepted = await provider.api.post(`/api/bookings/${bookingId}/accept`);
  expect(accepted.status).toBe(200);
  return { bookingId, providerApi: provider.api };
}

describe('booking completion/cancellation clears cached live-location state', () => {
  it('on completion', async () => {
    const { bookingId, providerApi } = await acceptedBooking();
    expect((await providerApi.post(`/api/bookings/${bookingId}/en-route`)).status).toBe(200);
    expect((await providerApi.post(`/api/bookings/${bookingId}/arrived`)).status).toBe(200);
    expect((await providerApi.post(`/api/bookings/${bookingId}/start`)).status).toBe(200);
    // `cleaning` is hourly-priced: its price is only settled at completion,
    // from the time actually worked, so some time must pass first.
    t.clock.advanceSeconds(60);
    forgetBooking.mockClear();

    expect((await providerApi.post(`/api/bookings/${bookingId}/complete`)).status).toBe(200);

    expect(forgetBooking).toHaveBeenCalledWith(bookingId);
  });

  it('on customer cancellation', async () => {
    const { bookingId } = await acceptedBooking();
    forgetBooking.mockClear();

    const res = await customer.post(`/api/bookings/${bookingId}/cancel`, {
      reason: 'Changed my mind.',
    });
    expect(res.status).toBe(200);

    expect(forgetBooking).toHaveBeenCalledWith(bookingId);
  });

  it('on provider release', async () => {
    const { bookingId, providerApi } = await acceptedBooking();
    forgetBooking.mockClear();

    const res = await providerApi.post(`/api/bookings/${bookingId}/release`, {
      reason: 'Vehicle broke down.',
    });
    expect(res.status).toBe(200);

    expect(forgetBooking).toHaveBeenCalledWith(bookingId);
  });

  it('on matching-window expiry', async () => {
    const created = await customer.post('/api/bookings', {
      categorySlug: 'cleaning', // no providers offered it in this test, so it just expires
      citySlug: 'colombo',
      bookingType: 'on_demand',
      serviceAddress: '12 Galle Road',
    });
    expect(created.status).toBe(201);
    const bookingId = (created.body as { id: string }).id;
    forgetBooking.mockClear();

    t.clock.advanceSeconds(MATCHING_WINDOW_MS / 1000 + 1);
    const { api: freshCustomer } = await signInUser(t.app, t.sms, customerPhone);
    const res = await freshCustomer.get(`/api/bookings/${bookingId}`);

    expect(res.status).toBe(200);
    expect(forgetBooking).toHaveBeenCalledWith(bookingId);
  });

  it('is not called for a non-terminal transition (en route)', async () => {
    const { bookingId, providerApi } = await acceptedBooking();
    forgetBooking.mockClear();

    expect((await providerApi.post(`/api/bookings/${bookingId}/en-route`)).status).toBe(200);

    expect(forgetBooking).not.toHaveBeenCalled();
  });
});
