'use client';

import { create } from 'zustand';
import type { Locale, Translations, TechTranslations } from '@/lib/i18n/types';
import { en, enTech } from '@/lib/i18n/en';
import { ru, ruTech } from '@/lib/i18n/ru';

const TRANSLATIONS: Record<Locale, Translations> = { en, ru };
const TECH_TRANSLATIONS: Record<Locale, TechTranslations> = { en: enTech, ru: ruTech };
const STORAGE_KEY = 'conflict-game-locale';
const TUTORIAL_KEY = 'conflict-game-tutorial-done';

function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'ru') return stored;
  return null;
}

interface LocaleStore {
  locale: Locale | null; // null = not yet chosen (show picker)
  t: Translations;
  tech: TechTranslations;
  setLocale: (locale: Locale) => void;
  isFirstLaunch: boolean;
  /** Whether the onboarding tutorial should be shown */
  showTutorial: boolean;
  setShowTutorial: (v: boolean) => void;
  markTutorialDone: () => void;
}

export const useLocaleStore = create<LocaleStore>((set) => {
  const stored = typeof window !== 'undefined' ? getStoredLocale() : null;
  const tutorialDone = typeof window !== 'undefined' ? localStorage.getItem(TUTORIAL_KEY) === '1' : false;
  return {
    locale: stored,
    t: TRANSLATIONS[stored ?? 'en'],
    tech: TECH_TRANSLATIONS[stored ?? 'en'],
    isFirstLaunch: !stored,
    showTutorial: !stored && !tutorialDone, // show on first launch if tutorial not done
    setLocale: (locale: Locale) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, locale);
      }
      set({ locale, t: TRANSLATIONS[locale], tech: TECH_TRANSLATIONS[locale], isFirstLaunch: false });
    },
    setShowTutorial: (v: boolean) => set({ showTutorial: v }),
    markTutorialDone: () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(TUTORIAL_KEY, '1');
      }
      set({ showTutorial: false });
    },
  };
});
