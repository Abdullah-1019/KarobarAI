import { useCallback } from 'react';

import type { Language } from '@karobarai/shared';
import { apiClient } from '../api';
import { useAuthStore } from '../lib/authStore';
import { useLanguageStore } from '../lib/languageStore';

// Thin hook wrapper so features import from `hooks/`, not the zustand store directly.
export function useLanguage() {
  const language = useLanguageStore((state) => state.language);
  const dir = useLanguageStore((state) => state.dir);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  // Applies the change instantly — i18next, `<html lang/dir>`, AntD `direction` (via the store's
  // `dir`) and localStorage all update with no reload (SRS §2.5) — and, for a signed-in user,
  // persists the preference to their profile in the background. The PATCH is fire-and-forget: the
  // UI must never wait on the network for a language switch, and a failed write shouldn't revert
  // what the user just chose on this device. Guests (Login/Register) have no session to write to,
  // so the guard simply skips it.
  const changeLanguage = useCallback(
    (next: Language) => {
      setLanguage(next);
      if (useAuthStore.getState().user) {
        void apiClient.patch('/profile/me/settings', { preferredLanguage: next }).catch(() => {});
      }
    },
    [setLanguage],
  );

  return { language, dir, setLanguage, changeLanguage };
}
