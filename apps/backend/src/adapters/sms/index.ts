import { config } from '../../core/config';
import { LiveSmsAdapter } from './live';
import { MockSmsAdapter } from './mock';

// SmsAdapter (D2): mock in MVP, selected via ADAPTER_MODE + this factory (TRD §28). First real
// adapter implementation in the codebase — payment/courier/whatsapp/maps follow this same shape
// when their features land.
export interface SmsAdapter {
  sendSms(
    to: string,
    templateKey: string,
    vars: Record<string, unknown>,
    lang: 'EN' | 'UR',
  ): Promise<void>;
}

let cachedAdapter: SmsAdapter | null = null;

export function getSmsAdapter(): SmsAdapter {
  if (!cachedAdapter) {
    cachedAdapter = config.adapterMode === 'live' ? new LiveSmsAdapter() : new MockSmsAdapter();
  }
  return cachedAdapter;
}
