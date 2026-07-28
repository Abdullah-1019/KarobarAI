import type { Language } from '@karobarai/shared';
import { create } from 'zustand';

import i18n, { RTL_LANGUAGES } from '../app/i18n';

interface LanguageState {
  language: Language;
  dir: 'ltr' | 'rtl';
  setLanguage: (language: Language) => void;
}

function dirFor(language: Language): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.includes(language as (typeof RTL_LANGUAGES)[number]) ? 'rtl' : 'ltr';
}

// Zustand (TRD §4) — minimal global state; language drives i18next, AntD `direction`, and
// `<html dir>` together so switching is instant with no reload (SRS §2.5).
export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'EN',
  dir: 'ltr',
  setLanguage: (language) => {
    void i18n.changeLanguage(language.toLowerCase());
    const dir = dirFor(language);
    document.documentElement.lang = language.toLowerCase();
    document.documentElement.dir = dir;
    set({ language, dir });
  },
}));
