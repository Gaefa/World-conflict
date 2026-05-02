'use client';

import { useState } from 'react';
import { useLocaleStore } from '@/stores/localeStore';
import type { Translations } from '@/lib/i18n/types';

// Map event type → localized title key
const EVENT_TYPE_TITLE: Partial<Record<string, keyof Translations>> = {
  war_declared:            'ev_type_war_declared',
  peace_treaty:            'ev_type_peace_treaty',
  alliance_formed:         'ev_type_alliance_formed',
  alliance_broken:         'ev_type_alliance_broken',
  battle_result:           'ev_type_battle_result',
  trade_agreement:         'ev_type_trade_agreement',
  sanction_imposed:        'ev_type_sanction_imposed',
  sanction_lifted:         'ev_type_sanction_lifted',
  revolution:              'ev_type_revolution',
  coup:                    'ev_type_coup',
  economic_crisis:         'ev_type_economic_crisis',
  economic_boom:           'ev_type_economic_boom',
  technology_breakthrough: 'ev_type_tech_breakthrough',
  supply_shock:            'ev_type_supply_shock',
  price_spike:             'ev_type_price_spike',
  stockpile_depleted:      'ev_type_stockpile_depleted',
  trade_disrupted:         'ev_type_trade_disrupted',
  contraband_discovered:   'ev_type_contraband',
  spy_caught:              'ev_type_spy_caught',
  spy_success:             'ev_type_spy_success',
  tech_completed:          'ev_type_tech_completed',
  victory:                 'ev_type_victory',
  civil_unrest:            'ev_type_civil_unrest',
};

function localizeEventTitle(t: Translations, eventType: string, fallback: string): string {
  const key = EVENT_TYPE_TITLE[eventType];
  if (key && t[key]) return t[key] as string;
  return fallback;
}

interface GameEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tick: number;
}

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function tickToDate(tick: number, locale: string): string {
  const startYear = 2026;
  const month = tick % 12;
  const year = startYear + Math.floor(tick / 12);
  const months = locale === 'ru' ? MONTH_NAMES_RU : MONTH_NAMES_EN;
  return `${months[month]} ${year}`;
}

const SEVERITY_STYLES = {
  low: 'border-l-accent-blue text-accent-blue',
  medium: 'border-l-accent-amber text-accent-amber',
  high: 'border-l-severity-high text-severity-high',
  critical: 'border-l-severity-critical text-severity-critical',
} as const;

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'] as const;
type Severity = (typeof SEVERITY_LEVELS)[number];

const FILTER_COLORS: Record<Severity, { active: string; inactive: string }> = {
  critical: { active: 'bg-severity-critical text-white', inactive: 'text-severity-critical border-severity-critical/30' },
  high: { active: 'bg-severity-high text-white', inactive: 'text-severity-high border-severity-high/30' },
  medium: { active: 'bg-accent-amber text-black', inactive: 'text-accent-amber border-accent-amber/30' },
  low: { active: 'bg-accent-blue text-white', inactive: 'text-accent-blue border-accent-blue/30' },
};

interface EventsFeedProps {
  events: GameEvent[];
}

export function EventsFeed({ events }: EventsFeedProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [minSeverity, setMinSeverity] = useState<Severity>('medium');
  const { t, locale } = useLocaleStore();

  const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const minRank = severityRank[minSeverity] ?? 0;
  const filtered = events.filter(e => (severityRank[e.severity] ?? 0) >= minRank);

  const sevLabels: Record<Severity, string> = {
    critical: t.ev_severity_crit,
    high: t.ev_severity_high,
    medium: t.ev_severity_medium,
    low: t.ev_severity_low,
  };

  return (
    <aside
      className={`bg-bg-secondary border-r border-border-default flex flex-col shrink-0 transition-all duration-300 ${
        collapsed ? 'w-10' : 'w-80'
      }`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-b border-border-default flex items-center gap-2 hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-xs">{collapsed ? '▶' : '◀'}</span>
        {!collapsed && (
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
            {t.ev_title}
          </h2>
        )}
      </button>

      {!collapsed && (
        <>
          {/* Severity filter bar */}
          <div className="px-3 pt-2 pb-1 flex gap-1 border-b border-border-default">
            {SEVERITY_LEVELS.map(sev => {
              const isActive = (severityRank[sev] ?? 0) >= minRank;
              const colors = FILTER_COLORS[sev];
              return (
                <button
                  key={sev}
                  onClick={() => setMinSeverity(sev)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border transition-colors ${
                    minSeverity === sev
                      ? colors.active + ' border-transparent'
                      : isActive
                        ? colors.inactive + ' bg-transparent border'
                        : 'text-text-muted border-border-default bg-transparent opacity-40'
                  }`}
                >
                  {sevLabels[sev]}
                </button>
              );
            })}
          </div>
          <div className="px-3 py-1 text-[10px] text-text-muted">
            {t.ev_count_fmt.replace('{shown}', String(filtered.length)).replace('{total}', String(events.length))}
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="text-text-muted text-sm text-center py-8">
                {events.length === 0 ? t.ev_none_yet : t.ev_none_filter}
              </div>
            ) : (
              filtered.map((event) => (
                <div
                  key={event.id}
                  className={`bg-bg-card border-l-2 ${SEVERITY_STYLES[event.severity]} p-2 rounded-r text-xs animate-fade-in`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-text-primary">{localizeEventTitle(t, event.type, event.title)}</span>
                    <span className="text-text-muted font-mono text-[10px]">{tickToDate(event.tick, locale ?? 'en')}</span>
                  </div>
                  <p className="text-text-secondary">{event.description}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}
