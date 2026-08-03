import type { WhatsAppAdapter } from './index';

// Stub until real Meta Cloud API credentials + Business approval exist (TRD §28 — live mode
// requires Meta Business approval, an onboarding step this task does not resolve; deferred to
// Feature 16). Throwing here makes it obvious immediately if ADAPTER_MODE is ever flipped to
// "live" before this is actually implemented.
export class LiveWhatsAppAdapter implements WhatsAppAdapter {
  async sendTemplate(): Promise<void> {
    throw new Error('LiveWhatsAppAdapter not implemented — no Meta Cloud API credentials/approval configured yet');
  }
}
