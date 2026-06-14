import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Package-local bundles: lootopia-mobile/locales/{locale}/*.json
import enCommon from '../../locales/en/common.json';
import enAuth from '../../locales/en/auth.json';
import enHunts from '../../locales/en/hunts.json';
import enPartner from '../../locales/en/partner.json';
import enValidation from '../../locales/en/validation.json';

import frCommon from '../../locales/fr/common.json';
import frAuth from '../../locales/fr/auth.json';
import frHunts from '../../locales/fr/hunts.json';
import frPartner from '../../locales/fr/partner.json';
import frValidation from '../../locales/fr/validation.json';

export const LOCALE_STORAGE_KEY = 'lootopia-mobile-locale';
export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    hunts: enHunts,
    partner: enPartner,
    validation: enValidation,
  },
  fr: {
    common: frCommon,
    auth: frAuth,
    hunts: frHunts,
    partner: frPartner,
    validation: frValidation,
  },
};

function resolveInitialLocale(stored: string | null): AppLocale {
  if (stored === 'en' || stored === 'fr') {
    return stored;
  }
  const deviceCode = Localization.getLocales()[0]?.languageCode ?? 'en';
  return deviceCode.startsWith('fr') ? 'fr' : 'en';
}

export function getDateLocale(): string {
  return i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
}

export async function setAppLocale(locale: AppLocale): Promise<void> {
  await i18n.changeLanguage(locale);
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

let initPromise: Promise<void> | null = null;

export function initI18n(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
      const lng = resolveInitialLocale(stored);

      await i18n.use(initReactI18next).init({
        resources,
        lng,
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: ['common', 'auth', 'hunts', 'partner', 'validation'],
        interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
        compatibilityJSON: 'v4',
      });
    })();
  }
  return initPromise;
}

export default i18n;
