'use client';

import type { CountryState, PlayerAction, DiplomaticRelation, Army } from '@conflict-game/shared-types';
import type { Translations } from '@/lib/i18n/types';

export const TAB_KEYS = ['Economy', 'Military', 'Diplomacy', 'Intelligence', 'Research', 'Domestic'] as const;
export const PRIMARY_TABS: Tab[] = ['Economy', 'Military', 'Diplomacy'];
export const SECONDARY_TABS: Tab[] = ['Intelligence', 'Research', 'Domestic'];
export type Tab = (typeof TAB_KEYS)[number];

export function getTabLabel(t: Translations, tab: Tab): string {
  const map: Record<Tab, string> = {
    Economy: t.tab_economy,
    Military: t.tab_military,
    Diplomacy: t.tab_diplomacy,
    Intelligence: t.tab_intelligence,
    Research: t.tab_research,
    Domestic: t.tab_domestic,
  };
  return map[tab];
}

export interface TabProps {
  country: CountryState;
  canAct: boolean;
  onAction?: (action: PlayerAction) => void;
  targetCountryCode?: string | null;
  playerCountryCode?: string | null;
  hasSanctions?: boolean;
  relations?: DiplomaticRelation[];
  currentTick?: number;
  /** All armies in the session (for military map) */
  armies?: Army[];
  /** Full countries record (for map coloring) */
  allCountries?: Record<string, CountryState>;
  /** Country codes the player is currently at war with (for auto war-mode) */
  warCountries?: Set<string>;
}

// ── Stat helpers ──

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-bg-card rounded p-3 border border-border-default">
      <div className="text-text-muted text-xs uppercase mb-1">{label}</div>
      <div className="text-text-primary text-lg font-mono font-bold">{value}</div>
      {sub && <div className="text-text-muted text-xs mt-1">{sub}</div>}
    </div>
  );
}

export function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-mono">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-bg-card rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EffectRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border-default last:border-0">
      <span className="text-text-secondary text-sm">{label}</span>
      <span className={`text-sm font-mono ${positive ? 'text-accent-green' : positive === false ? 'text-severity-high' : 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}

export interface ActionBtnProps {
  label: string;
  cost: string;
  effect: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function ActionBtn({ label, cost, effect, disabled, onClick }: ActionBtnProps) {
  const hasUnknown = effect.includes('???');
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left border border-border-default rounded p-2 mb-1.5 transition-colors group ${
        disabled
          ? 'bg-bg-card opacity-50 cursor-not-allowed'
          : 'bg-bg-card hover:bg-bg-hover cursor-pointer'
      }`}
    >
      <div className={`text-sm font-medium transition-colors ${
        disabled ? 'text-text-muted' : 'text-text-primary group-hover:text-accent-red'
      }`}>
        {label}
      </div>
      <div className="flex justify-between text-xs mt-0.5">
        <span className="text-accent-amber">{cost}</span>
        <span className={hasUnknown ? 'text-text-muted' : 'text-text-secondary'}>
          {effect}
        </span>
      </div>
    </button>
  );
}

export function getResourceLabel(t: Translations, key: string): string {
  return (t as any)['rlabel_' + key] ?? key;
}

export function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}
