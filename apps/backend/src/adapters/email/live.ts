import type { EmailAdapter } from './index';

// Stub until real SendGrid/SES credentials exist (TRD §28, optional/not MVP-required).
export class LiveEmailAdapter implements EmailAdapter {
  async sendEmail(): Promise<void> {
    throw new Error('LiveEmailAdapter not implemented — no email provider credentials configured yet');
  }
}
