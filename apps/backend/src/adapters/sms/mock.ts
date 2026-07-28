import { logger } from '../../core/logger';
import type { SmsAdapter } from './index';

// Deterministic mock (D2): logs what would have been sent instead of calling a real provider.
// This is how OTP codes are "delivered" in dev/test — read them from the log output.
export class MockSmsAdapter implements SmsAdapter {
  async sendSms(
    to: string,
    templateKey: string,
    vars: Record<string, unknown>,
    lang: 'EN' | 'UR',
  ): Promise<void> {
    logger.info(
      { to, templateKey, vars, lang },
      '[MockSmsAdapter] SMS not actually sent (ADAPTER_MODE=mock)',
    );
  }
}
