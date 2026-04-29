import { Injectable, Logger } from '@nestjs/common';
import type { OutboxItem } from '@prisma/client';

import { DevicesService } from '../../devices/devices.service.js';

/**
 * Send a push notification to all devices for a target user, via Expo's
 * HTTP push API. We use Expo (not FCM/APNs directly) so the same code
 * works on Android + iOS without juggling certificates — Expo brokers
 * the actual delivery to FCM/APNs from their side.
 *
 * No auth is needed for the Expo push endpoint as long as the target
 * tokens are valid `ExponentPushToken[…]` strings.
 *
 * Phase-4 stretches:
 *   - Read-receipt polling (Expo gives a ticket id; the receipt comes
 *     back via a second API call after a few seconds).
 *   - Token cleanup when Expo says "DeviceNotRegistered" (uninstalled
 *     app) — currently logged but the row stays in the DB.
 */
export interface PushOutboxPayload {
  userId: string;
  title: string;
  body: string;
  /** Free-form data the mobile app interprets to deep-link. */
  data?: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: 'default';
  priority: 'high';
  channelId: 'default';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class ExpoPushHandler {
  readonly kind = 'push_notification';
  private readonly logger = new Logger(ExpoPushHandler.name);

  constructor(private readonly devices: DevicesService) {}

  async process(item: OutboxItem): Promise<void> {
    const payload = item.payload as PushOutboxPayload;
    const tokens = await this.devices.tokensForUser(payload.userId);

    if (tokens.length === 0) {
      // User has never opened the mobile app. That's not an error.
      this.logger.log(
        `Skipping push for user ${payload.userId} — no registered devices`,
      );
      return;
    }

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Expo push HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    const json = (await res.json()) as { data: ExpoPushTicket[] };
    const errored = json.data.filter((t) => t.status === 'error');
    for (const e of errored) {
      this.logger.warn(`Expo push error: ${e.message ?? 'unknown'}`);
      // Detail of `DeviceNotRegistered` means the token is dead — we
      // could prune here. Deferred to Phase-4 stretch.
    }
  }
}
