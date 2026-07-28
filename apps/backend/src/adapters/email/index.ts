import { config } from '../../core/config';
import { LiveEmailAdapter } from './live';
import { MockEmailAdapter } from './mock';

// EmailAdapter (D2 shape, same as SmsAdapter): needed for password-reset delivery to
// email-registered accounts — no email delivery channel existed anywhere before this feature.
export interface EmailAdapter {
  sendEmail(
    to: string,
    templateKey: string,
    vars: Record<string, unknown>,
    lang: 'EN' | 'UR',
  ): Promise<void>;
}

let cachedAdapter: EmailAdapter | null = null;

export function getEmailAdapter(): EmailAdapter {
  if (!cachedAdapter) {
    cachedAdapter = config.adapterMode === 'live' ? new LiveEmailAdapter() : new MockEmailAdapter();
  }
  return cachedAdapter;
}
