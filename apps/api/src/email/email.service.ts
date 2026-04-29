import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('SMTP_FROM');
    const host = config.getOrThrow<string>('SMTP_HOST');
    const port = config.getOrThrow<number>('SMTP_PORT');
    const user = config.get<string>('SMTP_USER') ?? '';
    const pass = config.get<string>('SMTP_PASS') ?? '';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: user ? { user, pass } : undefined,
    });
  }

  async send(to: string[], subject: string, html: string, text?: string): Promise<void> {
    if (to.length === 0) return;
    await this.transporter.sendMail({
      from: this.from,
      to: to.join(','),
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, ''),
    });
    this.logger.log(`Sent "${subject}" to ${to.length} recipient(s)`);
  }
}
