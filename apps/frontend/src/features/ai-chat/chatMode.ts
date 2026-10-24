import { useState } from 'react';
import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

export type ChatMode = 'fast' | 'slow';

const isMode = (value: unknown): value is ChatMode => value === 'fast' || value === 'slow';

// The chosen assistant mode is a per-viewer preference, remembered per chat (buyer store chat vs
// seller assistant). Storage can be unavailable (private mode), so every access is guarded and
// Fast Mode is the default.
export function useChatMode(storageKey: string): [ChatMode, (mode: ChatMode) => void] {
  const [mode, setModeState] = useState<ChatMode>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return isMode(saved) ? saved : 'fast';
    } catch {
      return 'fast';
    }
  });
  const setMode = (next: ChatMode) => {
    setModeState(next);
    try { window.localStorage.setItem(storageKey, next); } catch { /* preference only */ }
  };
  return [mode, setMode];
}

/** A specific, actionable message for a failed assistant request, or null for the generic one. */
export function chatErrorMessage(error: unknown, t: TFunction): string | null {
  const code = error instanceof ApiError ? error.code : null;
  switch (code) {
    case 'FAST_MODE_NOT_CONFIGURED': return t('common:aiMode.errors.fastNotConfigured');
    case 'FAST_MODE_RATE_LIMITED': return t('common:aiMode.errors.fastBusy');
    case 'FAST_MODE_TIMEOUT':
    case 'FAST_MODE_UNAVAILABLE': return t('common:aiMode.errors.fastUnavailable');
    case 'LOCAL_AI_UNAVAILABLE': return t('common:aiMode.errors.slowUnavailable');
    case 'BUYER_CHAT_RATE_LIMIT':
    case 'SELLER_CHAT_RATE_LIMIT': return t('common:aiMode.errors.tooMany');
    default: return null;
  }
}
