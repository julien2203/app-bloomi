import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

import en from '../locales/en.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import it from '../locales/it.json';
import catalogEn from '../locales/catalog/en.json';
import catalogFr from '../locales/catalog/fr.json';
import catalogDe from '../locales/catalog/de.json';
import catalogIt from '../locales/catalog/it.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'de', 'it'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = 'fr';
export const LANGUAGE_STORAGE_KEY = 'bloomi_app_language_v1';

const resources = {
  fr: { translation: { ...fr, catalog: catalogFr } },
  en: { translation: { ...en, catalog: catalogEn } },
  de: { translation: { ...de, catalog: catalogDe } },
  it: { translation: { ...it, catalog: catalogIt } }
} as const;

export function normalizeLanguage(lang: string | null | undefined): AppLanguage {
  const code = lang?.trim().toLowerCase().split('-')[0];
  if (code === 'en' || code === 'fr' || code === 'de' || code === 'it') {
    return code;
  }
  return DEFAULT_LANGUAGE;
}

try {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: {
      de: ['en', 'fr'],
      it: ['en', 'fr'],
      en: ['fr'],
      default: ['fr']
    },
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  });
} catch (error) {
  console.warn('[i18n] init failed, falling back to English:', error);
  void i18n.use(initReactI18next).init({
    resources: { fr: { translation: fr }, en: { translation: en } },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  });
}

export async function getStoredLanguage(): Promise<AppLanguage | null> {
  try {
    const raw = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!raw) return null;
    return normalizeLanguage(raw);
  } catch {
    return null;
  }
}

export async function setStoredLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export async function fetchProfileLanguage(userId: string): Promise<AppLanguage | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.language) {
    return null;
  }

  return normalizeLanguage(String(data.language));
}

/** Profil connecté → préférence locale, sinon profil, sinon `fr`. */
export async function resolveAppLanguage(userId?: string | null): Promise<AppLanguage> {
  const stored = await getStoredLanguage();
  if (stored) {
    return stored;
  }

  if (userId) {
    const profileLang = await fetchProfileLanguage(userId);
    if (profileLang) {
      return profileLang;
    }
  }

  return DEFAULT_LANGUAGE;
}

export async function applyAppLanguage(lang: AppLanguage): Promise<void> {
  const normalized = normalizeLanguage(lang);
  await i18n.changeLanguage(normalized);
  await setStoredLanguage(normalized);
}

export async function saveProfileLanguage(
  userId: string,
  lang: AppLanguage
): Promise<{ error: Error | null }> {
  const normalized = normalizeLanguage(lang);
  const { error } = await supabase.from('profiles').update({ language: normalized }).eq('id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  await applyAppLanguage(normalized);
  return { error: null };
}

/** Applique la langue au démarrage (sans écrire en base). */
export async function initAppLanguage(userId?: string | null): Promise<AppLanguage> {
  const lang = await resolveAppLanguage(userId ?? undefined);
  await i18n.changeLanguage(lang);
  const stored = await getStoredLanguage();
  if (!stored) {
    await setStoredLanguage(lang);
  }
  return lang;
}

/** Traduction pour un destinataire (push, etc.) selon `profiles.language`. */
export async function translateForUser(
  userId: string,
  key: string,
  options?: Record<string, unknown>
): Promise<string> {
  const profileLang = await fetchProfileLanguage(userId);
  const lang =
    profileLang ?? normalizeLanguage(i18n.language) ?? DEFAULT_LANGUAGE;
  return String(i18n.t(key, { ...(options ?? {}), lng: lang }));
}

export default i18n;
