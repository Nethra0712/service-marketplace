import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import type { PushMessage, PushProvider } from './push-provider.js';

export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Real Firebase Cloud Messaging integration, via the Admin SDK's service-
 * account credentials (never the client-side Firebase config). Structurally
 * complete — the same posture as `PayHereProvider`: this environment has no
 * real Firebase project to exercise it against, so it has never sent a live
 * push. `send` rejects on any delivery failure (including an unregistered or
 * expired token); `notifications.service.ts`'s `notify` catches that per
 * token and never lets one bad device stop delivery to the rest.
 */
export class FcmPushProvider implements PushProvider {
  readonly name = 'fcm' as const;

  private readonly app: App;

  constructor(config: FcmConfig) {
    // Firebase's SDK keeps a process-wide app registry; reuse an existing
    // default app (e.g. across hot reloads in dev) instead of throwing on a
    // second `initializeApp` call.
    const existing = getApps().find((app) => app.name === '[DEFAULT]');
    this.app =
      existing ??
      initializeApp({
        credential: cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey,
        }),
      });
  }

  async send(message: PushMessage): Promise<void> {
    await getMessaging(this.app).send({
      token: message.token,
      notification: { title: message.title, body: message.body },
      data: message.data,
    });
  }
}
