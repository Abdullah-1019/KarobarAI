import type { Language } from '@karobarai/shared';
import { create } from 'zustand';

import i18n, { RTL_LANGUAGES, getStoredLanguage, storeLanguage } from '../app/i18n';

interface LanguageState {
  language: Language;
  dir: 'ltr' | 'rtl';
  setLanguage: (language: Language) => void;
}

function dirFor(language: Language): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.includes(language as (typeof RTL_LANGUAGES)[number]) ? 'rtl' : 'ltr';
}

// Initial state comes from localStorage (i18n.ts already read the same key to pick i18next's
// starting language) so a reload on a pre-login page keeps its language instead of resetting to
// English. Once logged in, session-restore/login overwrite this with the account's DB-stored
// preferredLanguage, which takes priority.
const initialLanguage = getStoredLanguage();
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage.toLowerCase();
  document.documentElement.dir = dirFor(initialLanguage);
}

// Zustand (TRD §4) — minimal global state; language drives i18next, AntD `direction`, and
// `<html dir>` together so switching is instant with no reload (SRS §2.5).
export const useLanguageStore = create<LanguageState>((set) => ({
  language: initialLanguage,
  dir: dirFor(initialLanguage),
  setLanguage: (language) => {
    void i18n.changeLanguage(language.toLowerCase());
    storeLanguage(language);
    const dir = dirFor(language);
    document.documentElement.lang = language.toLowerCase();
    document.documentElement.dir = dir;
    set({ language, dir });
  },
}));
