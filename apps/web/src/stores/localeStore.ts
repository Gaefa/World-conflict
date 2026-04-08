'use client';

import { create } from 'zustand';
import type { Locale, Translations } from '@/lib/i18n/types';
import { en } from '@/lib/i18n/en';
import { ru } from '@/lib/i18n/ru';

const TRANSLATIONS: Record<Locale, Translations> = { en, ru };
const STORAGE_KEY = 'conflict-game-locale';

function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'ru') return stored;
  return null;
}

interface LocaleStore {
  locale: Locale | null; // null = not yet chosen (show picker)
  t: Translations;
  setLocale: (locale: Locale) => void;
  isFirstLaunch: boolean;
}

export const useLocaleStore = create<LocaleStore>((set) => {
  const stored = typeof window !== 'undefined' ? getStoredLocale() : null;
  return {
    locale: stored,
    t: TRANSLATIONS[stored ?? 'en'],
    isFirstLaunch: !stored,
    setLocale: (locale: Locale) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, locale);
      }
      set({ locale, t: TRANSLATIONS[locale], isFirstLaunch: false });
    },
  };
});
