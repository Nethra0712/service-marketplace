import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createLogger } from '../../src/lib/logger.js';
import { MockPushProvider } from '../../src/modules/notifications/mock-push-provider.js';
import {
  createNotificationsService,
  type NotificationsService,
} from '../../src/modules/notifications/notifications.service.js';
import { FakeClock } from '../helpers/app.js';
import { mustExist } from '../helpers/bookings.js';
import { createTestDatabase, resetDatabase } from '../helpers/database.js';
import {
  createBooking,
  createCity,
  createOfferedCategory,
  createUser,
} from '../helpers/factories.js';

const handle = createTestDatabase();
const { db } = handle;
afterAll(() => handle.close());

let clock: FakeClock;
let push: MockPushProvider;
let service: NotificationsService;
let bookingId: string;
let recipientId: string;

beforeEach(async () => {
  await resetDatabase(db);
  clock = new FakeClock();
  push = new MockPushProvider();
  service = createNotificationsService({
    db,
    clock: clock.now,
    provider: push,
    logger: createLogger({ logLevel: 'silent' }),
  });

  const city = await createCity(db);
  const category = await createOfferedCategory(db, city);
  const customer = await createUser(db);
  const booking = await createBooking(db, customer, category, city);
  bookingId = booking.id;
  recipientId = customer.id;
});

describe('device tokens', () => {
  it('registers a token and a later notify() reaches it', async () => {
    await service.registerToken(recipientId, 'token-1', 'android');
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });

    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]?.token).toBe('token-1');
  });

  it('re-registering the same token (a refresh) reassigns it rather than duplicating it', async () => {
    const other = await createUser(db);
    await service.registerToken(recipientId, 'shared-token', 'android');
    await service.registerToken(other.id, 'shared-token', 'android');

    // Now owned by `other`: a notify to the original recipient reaches nothing.
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    expect(push.sent).toHaveLength(0);

    await service.notify({ kind: 'booking_accepted', recipientUserId: other.id, bookingId });
    expect(push.sent).toHaveLength(1);
  });

  it("removeToken removes the caller's own token", async () => {
    await service.registerToken(recipientId, 'token-1', 'android');
    await service.removeToken(recipientId, 'token-1');

    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    expect(push.sent).toHaveLength(0);
  });

  it('removeToken is idempotent for a token that was never registered', async () => {
    await expect(service.removeToken(recipientId, 'never-registered')).resolves.toBeUndefined();
  });

  it('authorization: refuses to remove a token owned by someone else', async () => {
    const attacker = await createUser(db);
    await service.registerToken(recipientId, 'token-1', 'android');

    await expect(service.removeToken(attacker.id, 'token-1')).rejects.toMatchObject({
      code: 'DEVICE_TOKEN_NOT_OWNED',
    });
    // Untouched: still registered and reachable by its real owner.
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    expect(push.sent).toHaveLength(1);
  });

  it('a token reaches every device registered for that user', async () => {
    await service.registerToken(recipientId, 'token-1', 'android');
    await service.registerToken(recipientId, 'token-2', 'ios');
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });

    expect(push.sent.map((m) => m.token).sort()).toEqual(['token-1', 'token-2']);
  });
});

describe('push preferences', () => {
  it('defaults to enabled', async () => {
    expect(await service.getPreferences(recipientId)).toEqual({ pushEnabled: true });
  });

  it('disabling push stops delivery but still records the in-app notification', async () => {
    await service.registerToken(recipientId, 'token-1', 'android');
    await service.setPreferences(recipientId, { pushEnabled: false });

    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });

    expect(push.sent).toHaveLength(0);
    expect(await service.listNotifications(recipientId)).toHaveLength(1);
  });
});

describe('notify', () => {
  it('creates a durable notification record', async () => {
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    const items = await service.listNotifications(recipientId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'booking_accepted', bookingId, readAt: null });
  });

  it('does not duplicate the same event for the same recipient (no duplicate record, no duplicate push)', async () => {
    await service.registerToken(recipientId, 'token-1', 'android');
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });

    expect(await service.listNotifications(recipientId)).toHaveLength(1);
    expect(push.sent).toHaveLength(1);
  });

  it('the same event kind for a DIFFERENT booking is a distinct event, not a duplicate', async () => {
    const city = await createCity(db, { slug: 'kandy', name: 'Kandy' });
    const category = await createOfferedCategory(db, city, {
      slug: 'gardening',
      name: 'Gardening',
    });
    const secondBooking = await createBooking(db, { id: recipientId }, category, city);

    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    await service.notify({
      kind: 'booking_accepted',
      recipientUserId: recipientId,
      bookingId: secondBooking.id,
    });

    expect(await service.listNotifications(recipientId)).toHaveLength(2);
  });

  it("never throws, even if the push provider rejects for every device (delivery failure is not the caller's problem)", async () => {
    class FailingPushProvider extends MockPushProvider {
      override send(): Promise<void> {
        return Promise.reject(new Error('gateway unreachable'));
      }
    }
    const failing = createNotificationsService({
      db,
      clock: clock.now,
      provider: new FailingPushProvider(),
      logger: createLogger({ logLevel: 'silent' }),
    });
    await failing.registerToken(recipientId, 'token-1', 'android');

    await expect(
      failing.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId }),
    ).resolves.toBeUndefined();
    // The record is still there even though delivery failed.
    expect(await failing.listNotifications(recipientId)).toHaveLength(1);
  });

  it("localizes the title/body in the RECIPIENT's own preferred language, not a caller-supplied one", async () => {
    // No profile row for the recipient at all yet: still defaults to English cleanly.
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    const [item] = await service.listNotifications(recipientId);
    expect(item?.title).toBe('Booking accepted');
  });

  it('interpolates params into the copy (e.g. a payment amount)', async () => {
    await service.notify({
      kind: 'payment_succeeded',
      recipientUserId: recipientId,
      bookingId,
      params: { amount: '250.00', currency: 'LKR' },
    });
    const [item] = await service.listNotifications(recipientId);
    expect(item?.body).toContain('250.00');
    expect(item?.body).toContain('LKR');
  });
});

describe('the in-app feed', () => {
  it('lists newest first', async () => {
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    clock.advanceSeconds(60);
    await service.notify({ kind: 'provider_en_route', recipientUserId: recipientId, bookingId });

    const items = await service.listNotifications(recipientId);
    expect(items.map((i) => i.kind)).toEqual(['provider_en_route', 'booking_accepted']);
  });

  it('getUnreadCount counts only unread notifications', async () => {
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    await service.notify({ kind: 'provider_en_route', recipientUserId: recipientId, bookingId });
    expect(await service.getUnreadCount(recipientId)).toBe(2);

    const [first] = await service.listNotifications(recipientId);
    const firstId = mustExist(first, 'a notification').id;
    await service.markRead(recipientId, firstId);
    expect(await service.getUnreadCount(recipientId)).toBe(1);
  });

  it('markRead is idempotent (marking an already-read notification again just succeeds)', async () => {
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    const [item] = await service.listNotifications(recipientId);
    const itemId = mustExist(item, 'a notification').id;
    await service.markRead(recipientId, itemId);
    await expect(service.markRead(recipientId, itemId)).resolves.toBeUndefined();
  });

  it('authorization: markRead 404s for a notification that does not exist or belongs to someone else', async () => {
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    const [item] = await service.listNotifications(recipientId);
    const itemId = mustExist(item, 'a notification').id;
    const stranger = await createUser(db);

    await expect(service.markRead(stranger.id, itemId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    // Untouched: still unread for its real owner.
    expect(await service.getUnreadCount(recipientId)).toBe(1);
  });

  it('markAllRead clears every unread notification for the caller only', async () => {
    const other = await createUser(db);
    await service.notify({ kind: 'booking_accepted', recipientUserId: recipientId, bookingId });
    await service.notify({ kind: 'provider_en_route', recipientUserId: recipientId, bookingId });
    await service.notify({ kind: 'booking_accepted', recipientUserId: other.id, bookingId });

    await service.markAllRead(recipientId);

    expect(await service.getUnreadCount(recipientId)).toBe(0);
    expect(await service.getUnreadCount(other.id)).toBe(1);
  });
});
