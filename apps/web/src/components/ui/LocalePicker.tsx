'use client';

import { useLocaleStore } from '@/stores/localeStore';
import type { Locale } from '@/lib/i18n/types';

const LOCALE_OPTIONS: { code: Locale; label: string; flag: string; native: string }[] = [
  { code: 'en', label: 'English', flag: '\uD83C\uDDFA\uD83C\uDDF8', native: 'English' },
  { code: 'ru', label: 'Russian', flag: '\uD83C\uDDF7\uD83C\uDDFA', native: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439' },
];

/** Full-screen locale picker shown on first launch */
export function LocalePicker() {
  const { setLocale } = useLocaleStore();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
      <div className="bg-bg-secondary border border-border-default rounded-xl p-8 w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-accent-red font-bold text-2xl tracking-widest mb-2">
            CONFLICT.GAME
          </h1>
          <p className="text-text-secondary text-sm">
            Select Language / {'\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u044F\u0437\u044B\u043A'}
          </p>
        </div>

        <div className="space-y-3">
          {LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              onClick={() => setLocale(opt.code)}
              className="w-full flex items-center gap-4 bg-bg-card border border-border-default rounded-lg p-4 hover:border-accent-red hover:bg-bg-hover transition-all group"
            >
              <span className="text-3xl">{opt.flag}</span>
              <div className="text-left flex-1">
                <p className="text-text-primary font-bold text-lg group-hover:text-accent-red transition-colors">
                  {opt.native}
                </p>
                <p className="text-text-muted text-sm">{opt.label}</p>
              </div>
              <span className="text-text-muted group-hover:text-accent-red text-xl transition-colors">
                {'\u2192'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Small locale toggle button for the header */
export function LocaleToggle() {
  const { locale, setLocale } = useLocaleStore();

  const toggle = () => {
    setLocale(locale === 'en' ? 'ru' : 'en');
  };

  return (
    <button
      onClick={toggle}
      className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-bg-card border border-border-default text-text-muted hover:text-text-primary hover:border-accent-red transition-colors"
      title="Switch language"
    >
      {locale === 'en' ? 'RU' : 'EN'}
    </button>
  );
}
