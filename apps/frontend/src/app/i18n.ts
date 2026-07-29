import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { auth as authEn, common as commonEn } from '../locales/en';
import { auth as authUr, common as commonUr } from '../locales/ur';

export const RTL_LANGUAGES = ['UR'] as const;

// Lowercase codes for i18next itself; the app-level `Language` type (packages/shared) stays
// uppercase ('EN' | 'UR') to match the backend's user.language column.
i18n.use(initReactI18next).init({
  resources: {
    en: { common: commonEn, auth: authEn },
    ur: { common: commonUr, auth: authUr },
  },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'auth'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
