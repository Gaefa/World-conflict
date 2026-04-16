'use client';

import { useLocaleStore } from '@/stores/localeStore';
import { LocaleToggle } from '@/components/ui/LocalePicker';

interface HeaderProps {
  activeSessions: number;
  onlinePlayers: number;
  currentTick: number;
  isPaused: boolean;
  tensionIndex: number;
  onTogglePause?: () => void;
}

export function Header({
  activeSessions,
  onlinePlayers,
  currentTick,
  isPaused,
  tensionIndex,
  onTogglePause,
}: HeaderProps) {
  const { t, locale, setShowTutorial } = useLocaleStore();

  const tensionColor = tensionIndex > 70 ? 'text-severity-high' : tensionIndex > 40 ? 'text-amber-400' : 'text-accent-green';
  const tensionLabel = tensionIndex > 70 ? t.header_tension_critical : tensionIndex > 40 ? t.header_tension_elevated : t.header_tension_stable;

  return (
    <header className="h-12 bg-bg-secondary border-b border-border-default flex items-center px-4 shrink-0 z-50">
      <div className="flex items-center gap-2">
        <span className="text-accent-red font-bold text-lg tracking-widest">
          {t.app_name}
        </span>
      </div>

      <div className="flex-1 flex justify-center gap-3">
        <Stat value={activeSessions} label={t.header_active} icon="*" />
        <Stat value={onlinePlayers} label={t.header_players} icon="@" />
        <div className="flex items-center gap-2 bg-bg-card px-3 py-1 rounded border border-border-default">
          <span className={`${tensionColor} font-mono text-sm font-bold`}>{tensionIndex.toFixed(0)}</span>
          <span className={`${tensionColor} text-xs uppercase`}>{tensionLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowTutorial(true)}
          className="w-7 h-7 rounded-full border border-border-default bg-bg-card text-text-secondary hover:text-accent-red hover:border-accent-red transition-colors flex items-center justify-center text-sm font-bold"
          title={t.onb_start_playing}
          aria-label="Help / Tutorial"
        >
          ?
        </button>
        <LocaleToggle />
        <div className="flex items-center gap-2 bg-bg-card px-3 py-1 rounded border border-border-default">
          <span className="text-text-primary text-sm font-mono">{tickToDate(currentTick, locale ?? 'en')}</span>
          <span className="text-text-muted text-xs">{t.header_tick} {currentTick}</span>
        </div>
        <button
          onClick={onTogglePause}
          className={`px-3 py-1 rounded text-sm font-bold uppercase tracking-wider transition-colors border ${
            isPaused
              ? 'bg-accent-green/20 text-accent-green border-accent-green/40 hover:bg-accent-green/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
          }`}
        >
          {isPaused ? t.header_resume : t.header_pause}
        </button>
      </div>
    </header>
  );
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function tickToDate(tick: number, locale: string): string {
  const startYear = 2026;
  const totalMonths = tick;
  const year = startYear + Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const months = locale === 'ru' ? MONTHS_RU : MONTHS_EN;
  return `${months[month]} ${year}`;
}

function Stat({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 bg-bg-card px-3 py-1 rounded border border-border-default">
      <span className="text-text-muted text-xs">{icon}</span>
      <span className="text-text-primary font-mono text-sm font-bold">{value}</span>
      <span className="text-text-muted text-xs uppercase">{label}</span>
    </div>
  );
}
