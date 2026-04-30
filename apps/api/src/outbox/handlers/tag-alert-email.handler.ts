import { Injectable, Logger } from '@nestjs/common';
import type { OutboxItem } from '@prisma/client';

import { EmailService } from '../../email/email.service.js';
import { TagAlertsService } from '../../tag-alerts/tag-alerts.service.js';
import type { TagAlertOutboxPayload } from '../../tag-alerts/tag-alerts.service.js';

/**
 * Renders + sends the tag-alert email. Replaces the legacy raw `mail()`
 * call which used `From: crushthe` (an invalid local-part) and silently
 * SPF-failed at most receivers — the worker calls EmailService which is
 * configured with a verified sender and proper SMTP transport.
 */
@Injectable()
export class TagAlertEmailHandler {
  readonly kind = 'tag_alert_email';
  private readonly logger = new Logger(TagAlertEmailHandler.name);

  constructor(
    private readonly tagAlerts: TagAlertsService,
    private readonly email: EmailService,
  ) {}

  async process(item: OutboxItem): Promise<void> {
    const payload = item.payload as unknown as TagAlertOutboxPayload;
    const data = await this.tagAlerts.loadForEmail(payload.tagAlertId);
    if (!data) {
      this.logger.warn(`Tag alert ${payload.tagAlertId} disappeared before email send`);
      return;
    }

    if (data.recipients.length === 0) {
      // Nothing to do — but the alert still exists and is marked sent
      // so it doesn't sit in the outbox forever. Admin sees the alert
      // in the per-map log and can edit recipients to resend manually.
      this.logger.warn(
        `Tag alert ${payload.tagAlertId} has no recipients on map "${data.mapName}"; skipping`,
      );
      await this.tagAlerts.markEmailSent(payload.tagAlertId);
      return;
    }

    const subject = `[Map Alert] ${data.mapName} — ${data.alert.title}`;
    const html = renderHtml(data);
    const text = renderText(data);

    try {
      await this.email.send(data.recipients, subject, html, text);
      await this.tagAlerts.markEmailSent(payload.tagAlertId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.tagAlerts.markEmailFailed(payload.tagAlertId, message);
      throw err;
    }
  }
}

function renderHtml(d: {
  alert: { title: string; description: string; raisedByName: string; raisedAt: string };
  mapName: string;
  storeNumber: string;
  storeName: string;
  photoUrls: string[];
}): string {
  const photoTags = d.photoUrls
    .map(
      (u) =>
        `<a href="${u}"><img src="${u}" style="max-width:300px;border:1px solid #ccc;margin:4px;border-radius:4px"/></a>`,
    )
    .join('');

  const escDesc = escapeHtml(d.alert.description).replace(/\n/g, '<br/>');
  const escTitle = escapeHtml(d.alert.title);
  const escMap = escapeHtml(d.mapName);
  const escStoreName = escapeHtml(d.storeName);
  const escStoreNum = escapeHtml(d.storeNumber);
  const escRaisedBy = escapeHtml(d.alert.raisedByName);

  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;color:#111">
  <h2 style="color:#dc2626">Tag Alert: ${escTitle}</h2>
  <p><strong>Map:</strong> ${escMap}</p>
  <p><strong>Store:</strong> ${escStoreNum} — ${escStoreName}</p>
  <p><strong>Raised by:</strong> ${escRaisedBy} at ${escapeHtml(d.alert.raisedAt)}</p>
  <hr/>
  <p>${escDesc}</p>
  ${photoTags ? `<hr/><div>${photoTags}</div>` : ''}
</body></html>`;
}

function renderText(d: {
  alert: { title: string; description: string; raisedByName: string; raisedAt: string };
  mapName: string;
  storeNumber: string;
  storeName: string;
  photoUrls: string[];
}): string {
  const lines = [
    `Tag Alert: ${d.alert.title}`,
    `Map: ${d.mapName}`,
    `Store: ${d.storeNumber} — ${d.storeName}`,
    `Raised by: ${d.alert.raisedByName} at ${d.alert.raisedAt}`,
    '',
    d.alert.description,
  ];
  if (d.photoUrls.length > 0) {
    lines.push('', 'Photos:');
    for (const u of d.photoUrls) lines.push(u);
  }
  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
