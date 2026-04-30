import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OutboxItem } from '@prisma/client';

import { EmailService } from '../../email/email.service.js';

interface PasswordResetPayload {
  userId: string;
  email: string;
  rawToken: string;
}

/**
 * Sends the "you (or someone) requested a password reset" email. The
 * raw token is included only in the link the user clicks; we never log
 * it (the outbox payload is in the DB but TTLed via OutboxItem cleanup).
 */
@Injectable()
export class PasswordResetEmailHandler {
  readonly kind = 'password_reset_email';

  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async process(item: OutboxItem): Promise<void> {
    const payload = item.payload as unknown as PasswordResetPayload;
    const adminBase = this.config.get<string>('ADMIN_PUBLIC_URL') ?? 'http://localhost:3000';
    const link = `${adminBase.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(payload.rawToken)}`;

    const subject = 'Reset your Full Circle FM password';
    const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111">
      <h2>Reset your password</h2>
      <p>You (or someone) asked to reset the password on the Full Circle FM
      account associated with this email. Click below to set a new password
      — the link expires in 30 minutes.</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#ed7332;color:#fff;border-radius:6px;text-decoration:none">Reset password</a></p>
      <p style="color:#6b7280;font-size:12px;margin-top:16px">If you didn't request this you can safely ignore this email — your password won't change.</p>
    </body></html>`;

    const text = [
      'Reset your Full Circle FM password',
      '',
      'You (or someone) asked to reset the password on the account associated with this email.',
      'Open this link to set a new password (expires in 30 minutes):',
      '',
      link,
      '',
      "If you didn't request this you can ignore this email.",
    ].join('\n');

    await this.email.send([payload.email], subject, html, text);
  }
}
