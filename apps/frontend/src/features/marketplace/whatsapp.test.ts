import { afterEach, describe, expect, it, vi } from 'vitest';

// The module reads VITE_WHATSAPP_NUMBER at import time, so each case stubs the env then re-imports
// a fresh copy.
async function loadWith(value: string) {
  vi.stubEnv('VITE_WHATSAPP_NUMBER', value);
  vi.resetModules();
  return import('./whatsapp');
}

describe('getWhatsAppUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns null when no number is configured (never invents a number)', async () => {
    const { getWhatsAppUrl } = await loadWith('');

    expect(getWhatsAppUrl()).toBeNull();
    expect(getWhatsAppUrl('Hello')).toBeNull();
  });

  it('normalizes the number to digits and builds a wa.me link', async () => {
    const { getWhatsAppUrl } = await loadWith('+92 300-1234567');

    expect(getWhatsAppUrl()).toBe('https://wa.me/923001234567');
  });

  it('URL-encodes the prefilled message', async () => {
    const { getWhatsAppUrl } = await loadWith('923001234567');

    expect(getWhatsAppUrl('Hello & welcome')).toBe(
      'https://wa.me/923001234567?text=Hello%20%26%20welcome',
    );
  });
});
