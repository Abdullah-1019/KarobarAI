import { config } from '../../core/config';
import { LiveWhatsAppAdapter } from './live';
import { MockWhatsAppAdapter } from './mock';

// WhatsAppAdapter (D2) — Feature 9, Gap #2: PRD-scoped R1.1 (§12.12/§15 F19), pulled forward into
// this feature per explicit instruction, not a silent scope violation. Same interface+mock+live
// factory shape as sms/email/courier/payment (TRD §2/§28). Method name (`sendTemplate`) matches
// TRD §28's literal naming for the Meta Cloud API's template-message model.
export interface WhatsAppAdapter {
  sendTemplate(to: string, template: string, vars: Record<string, unknown>): Promise<void>;
}

let cachedAdapter: WhatsAppAdapter | null = null;

export function getWhatsAppAdapter(): WhatsAppAdapter {
  if (!cachedAdapter) {
    cachedAdapter = config.adapterMode === 'live' ? new LiveWhatsAppAdapter() : new MockWhatsAppAdapter();
  }
  return cachedAdapter;
}
