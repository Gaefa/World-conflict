'use client';

import { useState } from 'react';
import { useLocaleStore } from '@/stores/localeStore';
import type { Translations } from '@/lib/i18n/types';

interface Relation {
  id: string;
  type: string;
  fromCountry: string;
  toCountry: string;
  status: string;
  createdAtTick: number;
}

interface RelationsPanelProps {
  relations: Relation[];
  playerCountryCode: string | null;
  currentTick: number;
}

function getTypeConfig(t: Translations): Record<string, { label: string; color: string; bgColor: string }> {
  return {
    alliance: { label: t.rel_alliance, color: 'text-accent-blue', bgColor: 'bg-accent-blue/10 border-accent-blue/30' },
    war: { label: t.rel_war, color: 'text-severity-high', bgColor: 'bg-severity-high/10 border-severity-high/30' },
    trade_agreement: { label: t.rel_trade, color: 'text-accent-green', bgColor: 'bg-accent-green/10 border-accent-green/30' },
    sanction: { label: t.rel_sanction, color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/30' },
    non_aggression: { label: t.rel_nap, color: 'text-accent-blue', bgColor: 'bg-accent-blue/10 border-accent-blue/30' },
    ceasefire: { label: t.rel_ceasefire, color: 'text-text-secondary', bgColor: 'bg-bg-card border-border-default' },
    naval_blockade: { label: t.rel_blockade, color: 'text-severity-high', bgColor: 'bg-severity-high/10 border-severity-high/30' },
    smuggle_route: { label: t.rel_smuggle, color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/30' },
  };
}

const FILTERS = ['all', 'war', 'alliance', 'trade_agreement', 'sanction'] as const;

export function RelationsPanel({ relations, playerCountryCode, currentTick }: RelationsPanelProps) {
  const [filter, setFilter] = useState<string>('all');
  const [showMine, setShowMine] = useState(true);
  const { t } = useLocaleStore();
  const typeConfig = getTypeConfig(t);

  const activeRelations = relations.filter(r => r.status === 'active' || r.status === 'proposed');

  const filtered = activeRelations.filter(r => {
    if (filter !== 'all' && r.type !== filter) return false;
    if (showMine && playerCountryCode) {
      return r.fromCountry === playerCountryCode || r.toCountry === playerCountryCode;
    }
    return true;
  });

  // Count by type
  const counts = activeRelations.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const myWars = activeRelations.filter(
    r => r.type === 'war' && (r.fromCountry === playerCountryCode || r.toCountry === playerCountryCode)
  ).length;
  const myAllies = activeRelations.filter(
    r => r.type === 'alliance' && (r.fromCountry === playerCountryCode || r.toCountry === playerCountryCode)
  ).length;

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      {playerCountryCode && (
        <div className="flex gap-2 flex-wrap">
          <Badge label={t.rel_wars} count={myWars} color={myWars > 0 ? 'text-severity-high' : 'text-text-muted'} />
          <Badge label={t.rel_allies} count={myAllies} color={myAllies > 0 ? 'text-accent-blue' : 'text-text-muted'} />
          <Badge label={t.rel_global} count={activeRelations.length} color="text-text-secondary" />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-1 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 rounded text-xs uppercase transition-colors ${
              filter === f
                ? 'bg-accent-red/20 text-accent-red border border-accent-red/40'
                : 'bg-bg-card border border-border-default text-text-muted hover:text-text-primary'
            }`}
          >
            {f === 'all' ? t.rel_all : typeConfig[f]?.label ?? f}
            {f !== 'all' && counts[f] ? ` (${counts[f]})` : ''}
          </button>
        ))}
      </div>

      {/* Toggle mine/global */}
      {playerCountryCode && (
        <button
          onClick={() => setShowMine(!showMine)}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          {showMine ? t.rel_show_global : t.rel_show_mine}
        </button>
      )}

      {/* Relations list */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-text-muted text-xs text-center py-4">{t.rel_no_relations}</p>
        ) : (
          filtered.map(r => {
            const cfg = typeConfig[r.type] || { label: r.type, color: 'text-text-primary', bgColor: 'bg-bg-card border-border-default' };
            const duration = currentTick - r.createdAtTick;
            const isProposed = r.status === 'proposed';

            return (
              <div
                key={r.id}
                className={`flex items-center gap-2 rounded p-2 border text-sm ${cfg.bgColor} ${isProposed ? 'opacity-60' : ''}`}
              >
                <span className={`font-bold text-xs uppercase ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="text-text-primary font-mono text-xs">
                  {r.fromCountry}
                </span>
                <span className="text-text-muted text-xs">
                  {r.type === 'war' || r.type === 'sanction' ? t.rel_vs : '<>'}
                </span>
                <span className="text-text-primary font-mono text-xs">
                  {r.toCountry}
                </span>
                <span className="ml-auto text-text-muted text-[10px]">
                  {isProposed ? t.rel_pending : `${duration}${t.rel_months_short}`}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Badge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-bg-card border border-border-default rounded px-2 py-1 flex items-center gap-1">
      <span className={`font-mono font-bold text-sm ${color}`}>{count}</span>
      <span className="text-text-muted text-[10px] uppercase">{label}</span>
    </div>
  );
}
