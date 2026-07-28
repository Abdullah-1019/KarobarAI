import { logger } from '../../core/logger';
import type { EmailAdapter } from './index';

// Deterministic mock (D2): logs what would have been sent (e.g. the reset link/token) instead
// of calling a real provider (SendGrid/SES, TRD §28 — optional, not required for MVP).
export class MockEmailAdapter implements EmailAdapter {
  async sendEmail(
    to: string,
    templateKey: string,
    vars: Record<string, unknown>,
    lang: 'EN' | 'UR',
  ): Promise<void> {
    logger.info(
      { to, templateKey, vars, lang },
      '[MockEmailAdapter] email not actually sent (ADAPTER_MODE=mock)',
    );
  }
}
