import type { Language } from '@karobarai/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { auth as authEn, catalog as catalogEn, common as commonEn, profile as profileEn } from '../locales/en';
import { auth as authUr, catalog as catalogUr, common as commonUr, profile as profileUr } from '../locales/ur';

export const RTL_LANGUAGES = ['UR'] as const;

const LANGUAGE_STORAGE_KEY = 'karobarai:language';

// For logged-in users the DB's preferredLanguage is the source of truth (session-restore/login
// apply it). Pre-login there's no session to read from, so localStorage is the only thing that
// can survive a reload on Login/Register/Forgot Password — read synchronously here, before i18n
// even initializes, so the first paint is already correct instead of flashing English then
// switching.
export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'EN';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'UR' ? 'UR' : 'EN';
}

export function storeLanguage(language: Language): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

// Lowercase codes for i18next itself; the app-level `Language` type (packages/shared) stays
// uppercase ('EN' | 'UR') to match the backend's user.language column.
i18n.use(initReactI18next).init({
  resources: {
    en: { common: commonEn, auth: authEn, profile: profileEn, catalog: catalogEn },
    ur: { common: commonUr, auth: authUr, profile: profileUr, catalog: catalogUr },
  },
  lng: getStoredLanguage().toLowerCase(),
  fallbackLng: 'en',
  ns: ['common', 'auth', 'profile', 'catalog'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
