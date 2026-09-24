import { describe, expect, it } from 'vitest';

import { MockPushProvider } from '../../src/modules/notifications/mock-push-provider.js';

describe('MockPushProvider', () => {
  it('records every message it is asked to send, and contacts no real device', async () => {
    const provider = new MockPushProvider();
    await provider.send({ token: 'tok-1', title: 'Hi', body: 'Hello there' });
    expect(provider.sent).toEqual([{ token: 'tok-1', title: 'Hi', body: 'Hello there' }]);
  });

  it('lastMessageTo returns the most recent message sent to a token', async () => {
    const provider = new MockPushProvider();
    await provider.send({ token: 'tok-1', title: 'First', body: 'a' });
    await provider.send({ token: 'tok-2', title: 'Other device', body: 'b' });
    await provider.send({ token: 'tok-1', title: 'Second', body: 'c' });

    expect(provider.lastMessageTo('tok-1')?.title).toBe('Second');
    expect(provider.lastMessageTo('tok-2')?.title).toBe('Other device');
    expect(provider.lastMessageTo('tok-does-not-exist')).toBeUndefined();
  });
});
