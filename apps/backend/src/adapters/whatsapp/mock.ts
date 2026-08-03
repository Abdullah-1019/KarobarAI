import { logger } from '../../core/logger';
import type { WhatsAppAdapter } from './index';

// Deterministic mock (D2): logs what would have been sent instead of calling Meta's Cloud API.
export class MockWhatsAppAdapter implements WhatsAppAdapter {
  async sendTemplate(to: string, template: string, vars: Record<string, unknown>): Promise<void> {
    logger.info({ to, template, vars }, '[MockWhatsAppAdapter] WhatsApp message not actually sent (ADAPTER_MODE=mock)');
  }
}
