'use client';

import { useState } from 'react';
import { useLocaleStore } from '@/stores/localeStore';
import type { GameState } from '@conflict-game/shared-types';
import type { CountryData } from '@conflict-game/shared-types';

interface GoalsPanelProps {
  gameState: GameState;
  playerCountryCode: string;
  currentTick: number;
  seedCountries: CountryData[];
}

// ── Victory progress calculators ──────────────────────────────────────────────

function calcDomination(gameState: GameState, playerCode: string): number {
  const player = gameState.countries[playerCode];
  if (!player) return 0;
  // Need iOP ≥ 80 and > 1.5× second place
  const iops = Object.values(gameState.countries)
    .map(c => c.indexOfPower)
    .sort((a, b) => b - a);
  const playerIoP = player.indexOfPower;
  const second = iops[1] ?? 0;
  // Progress toward the threshold condition (heavier weight on the gap)
  const toThreshold = Math.min(100, (playerIoP / 80) * 100);
  const toGap = second > 0 ? Math.min(100, (playerIoP / (second * 1.5)) * 100) : 100;
  return Math.round(Math.min(toThreshold, toGap));
}

function calcEconomic(gameState: GameState, playerCode: string): number {
  const player = gameState.countries[playerCode];
  if (!player) return 0;
  const totalGDP = Object.values(gameState.countries).reduce((s, c) => s + c.economy.gdp, 0);
  if (totalGDP <= 0) return 0;
  return Math.round(Math.min(100, (player.economy.gdp / totalGDP / 0.4) * 100));
}

function calcDiplomatic(gameState: GameState, playerCode: string): { pct: number; n: number; total: number } {
  const allianceCount = gameState.relations.filter(
    r => r.type === 'alliance' && r.status === 'active' &&
      (r.fromCountry === playerCode || r.toCountry === playerCode),
  ).length;
  const total = Object.keys(gameState.countries).length - 1;
  if (total <= 0) return { pct: 0, n: 0, total: 0 };
  return {
    pct: Math.round(Math.min(100, (allianceCount / (total * 0.6)) * 100)),
    n: allianceCount,
    total,
  };
}

function calcTechnological(gameState: GameState, playerCode: string): { pct: number; n: number } {
  const player = gameState.countries[playerCode];
  const n = player?.tech?.researchedTechs.length ?? 0;
  return { pct: Math.round(Math.min(100, (n / 30) * 100)), n };
}

function calcSurvival(currentTick: number, sessionDurationTicks: number): { pct: number } {
  if (sessionDurationTicks <= 0) return { pct: 0 };
  return { pct: Math.round(Math.min(100, (currentTick / sessionDurationTicks) * 100)) };
}

// ── First-steps checklist (shown only in early game) ─────────────────────────

function getFirstSteps(
  gameState: GameState,
  playerCode: string,
): { key: string; done: boolean }[] {
  const country = gameState.countries[playerCode];
  const rel = gameState.relations;

  const hasResearch =
    (country?.tech?.activeResearch != null) ||
    (country?.tech?.researchedTechs.length ?? 0) > 0;

  const hasTrade = rel.some(
    r => r.type === 'trade_agreement' && r.status === 'active' &&
      (r.fromCountry === playerCode || r.toCountry === playerCode),
  );

  const hasAlliance = rel.some(
    r => r.type === 'alliance' &&
      (r.fromCountry === playerCode || r.toCountry === playerCode),
  );

  const hasStockpile = Object.values(country?.resourceState ?? {}).some(
    b => b && b.stockpile > 1,
  );

  return [
    { key: 'goals_step_country',   done: true },
    { key: 'goals_step_research',  done: hasResearch },
    { key: 'goals_step_trade',     done: hasTrade },
    { key: 'goals_step_alliance',  done: hasAlliance },
    { key: 'goals_step_stockpile', done: hasStockpile },
  ];
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-1 bg-bg-primary rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const FIRST_STEPS_MAX_TICK = 18; // show checklist for first 18 ticks (~1.5 years)

export function GoalsPanel({ gameState, playerCountryCode, currentTick, seedCountries: _seedCountries }: GoalsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLocaleStore();

  const dom  = calcDomination(gameState, playerCountryCode);
  const econ = calcEconomic(gameState, playerCountryCode);
  const diplo = calcDiplomatic(gameState, playerCountryCode);
  const tech = calcTechnological(gameState, playerCountryCode);
  const surv = calcSurvival(currentTick, gameState.session.settings.sessionDurationTicks);
  const steps = getFirstSteps(gameState, playerCountryCode);
  const showSteps = currentTick < FIRST_STEPS_MAX_TICK;
  const allStepsDone = steps.every(s => s.done);

  const goals: { labelKey: string; pct: number; detail?: string; color: string }[] = [
    { labelKey: 'goals_domination', pct: dom,    color: 'bg-accent-red' },
    { labelKey: 'goals_economic',   pct: econ,   color: 'bg-accent-amber' },
    { labelKey: 'goals_diplomatic', pct: diplo.pct, detail: `${diplo.n}/${Math.round(Object.keys(gameState.countries).length * 0.6)}`, color: 'bg-accent-blue' },
    { labelKey: 'goals_tech',       pct: tech.pct,  detail: `${tech.n}/30`, color: 'bg-accent-green' },
    { labelKey: 'goals_survival',   pct: surv.pct, color: 'bg-text-muted' },
  ];

  // Best progress for collapsed badge
  const topPct = Math.max(...goals.map(g => g.pct));

  return (
    <div className="bg-bg-secondary/90 backdrop-blur-sm border border-border-default rounded-lg shadow-xl overflow-hidden w-56">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors"
      >
        <span className="text-sm select-none">🏆</span>
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex-1 text-left">
          {t.goals_title}
        </span>
        {collapsed && (
          <span className="text-[10px] font-mono text-text-muted">{topPct}%</span>
        )}
        <span className="text-text-muted text-[10px]">{collapsed ? '▲' : '▼'}</span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-1.5">
          {/* Victory bars */}
          {goals.map(g => (
            <div key={g.labelKey} className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted w-20 truncate">
                {t[g.labelKey as keyof typeof t] as string}
              </span>
              <Bar pct={g.pct} color={g.color} />
              <span className="text-[10px] font-mono text-text-muted w-8 text-right">
                {g.detail ?? `${g.pct}%`}
              </span>
            </div>
          ))}

          {/* First steps checklist */}
          {showSteps && !allStepsDone && (
            <>
              <div className="border-t border-border-default my-1.5 pt-1.5">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                  {t.goals_first_steps}
                </p>
                {steps.map(s => (
                  <div key={s.key} className="flex items-center gap-1.5 py-0.5">
                    <span className={`text-[10px] ${s.done ? 'text-accent-green' : 'text-text-muted'}`}>
                      {s.done ? '✓' : '○'}
                    </span>
                    <span className={`text-[10px] ${s.done ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                      {t[s.key as keyof typeof t] as string}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
