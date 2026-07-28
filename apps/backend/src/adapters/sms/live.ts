import type { SmsAdapter } from './index';

// Stub until real Twilio/AWS SNS credentials exist (TRD §28). Throwing here (rather than
// silently no-oping) makes it obvious immediately if ADAPTER_MODE is ever flipped to "live"
// before this is actually implemented.
export class LiveSmsAdapter implements SmsAdapter {
  async sendSms(): Promise<void> {
    throw new Error('LiveSmsAdapter not implemented — no SMS provider credentials configured yet');
  }
}
