'use client';

import { useState } from 'react';
import type { CountryState, PlayerAction } from '@conflict-game/shared-types';

const TABS = ['Economy', 'Military', 'Diplomacy', 'Intelligence', 'Domestic'] as const;
type Tab = (typeof TABS)[number];

interface BottomTabsProps {
  country: CountryState | null;
  isNonPlayable?: boolean;
  countryName?: string;
  onAction?: (action: PlayerAction) => void;
  /** Country code of the target for diplomacy actions (the currently selected country on globe) */
  targetCountryCode?: string | null;
  /** The player's own country code */
  playerCountryCode?: string | null;
  /** Whether a game session is active */
  isGameActive?: boolean;
}

export function BottomTabs({
  country,
  isNonPlayable,
  countryName,
  onAction,
  targetCountryCode,
  playerCountryCode,
  isGameActive,
}: BottomTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  // Can this player perform actions? Only on their own country during active game
  const isOwnCountry = playerCountryCode && country?.code === playerCountryCode;
  const canAct = isGameActive && isOwnCountry && !!onAction;

  return (
    <>
      {activeTab && (
        <div className="h-64 bg-bg-secondary border-t border-border-default animate-slide-up overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                {activeTab}
                {country && (
                  <span className="ml-2 text-text-muted font-normal">— {countryName || country.code}</span>
                )}
              </h3>
              <button
                onClick={() => setActiveTab(null)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>
            {country ? (
              isNonPlayable ? (
                <div className="text-text-muted text-sm">
                  <p className="mb-2">{countryName || country.code} — Non-playable territory</p>
                  <p>Start a game session and conquer this territory to see full details.</p>
                </div>
              ) : (
                <TabContent
                  tab={activeTab}
                  country={country}
                  canAct={!!canAct}
                  onAction={onAction}
                  targetCountryCode={targetCountryCode}
                  playerCountryCode={playerCountryCode}
                />
              )
            ) : (
              <p className="text-text-muted text-sm">
                Click a country on the globe to view details.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="h-10 bg-bg-secondary border-t border-border-default flex items-center px-4 shrink-0">
        <div className="flex gap-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(activeTab === tab ? null : tab)}
              className={`text-xs uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'text-accent-red font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Stat helpers ──

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-bg-card rounded p-3 border border-border-default">
      <div className="text-text-muted text-xs uppercase mb-1">{label}</div>
      <div className="text-text-primary text-lg font-mono font-bold">{value}</div>
      {sub && <div className="text-text-muted text-xs mt-1">{sub}</div>}
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
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

function EffectRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border-default last:border-0">
      <span className="text-text-secondary text-sm">{label}</span>
      <span className={`text-sm font-mono ${positive ? 'text-accent-green' : positive === false ? 'text-severity-high' : 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}

interface ActionBtnProps {
  label: string;
  cost: string;
  effect: string;
  disabled?: boolean;
  onClick?: () => void;
}

function ActionBtn({ label, cost, effect, disabled, onClick }: ActionBtnProps) {
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

// ── Tab content ──

interface TabProps {
  country: CountryState;
  canAct: boolean;
  onAction?: (action: PlayerAction) => void;
  targetCountryCode?: string | null;
  playerCountryCode?: string | null;
}

function TabContent({ tab, ...props }: TabProps & { tab: Tab }) {
  switch (tab) {
    case 'Economy':
      return <EconomyTab {...props} />;
    case 'Military':
      return <MilitaryTab {...props} />;
    case 'Diplomacy':
      return <DiplomacyTab {...props} />;
    case 'Intelligence':
      return <IntelligenceTab {...props} />;
    case 'Domestic':
      return <DomesticTab {...props} />;
  }
}

function EconomyTab({ country, canAct, onAction }: TabProps) {
  const e = country.economy;

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard label="GDP" value={`$${(e.gdp / 1000).toFixed(1)}T`} sub={`Growth: ${e.gdpGrowth.toFixed(1)}%`} />
        <StatCard label="Budget" value={`$${e.budget.toFixed(0)}B`} sub={`Tax rate: ${(e.taxRate * 100).toFixed(0)}%`} />
        <StatCard label="Inflation" value={`${e.inflation.toFixed(1)}%`} sub={e.inflation > 5 ? 'High' : 'Stable'} />
        <StatCard label="Debt/GDP" value={`${(e.debtToGdp * 100).toFixed(0)}%`} sub={`Trade: ${e.tradeBalance > 0 ? '+' : ''}${e.tradeBalance.toFixed(0)}B`} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Indicators</h4>
          <EffectRow label="GDP Growth" value={`${e.gdpGrowth > 0 ? '+' : ''}${e.gdpGrowth.toFixed(1)}%`} positive={e.gdpGrowth > 0} />
          <EffectRow label="Trade Balance" value={`${e.tradeBalance > 0 ? '+' : ''}$${e.tradeBalance.toFixed(0)}B`} positive={e.tradeBalance > 0} />
          <EffectRow label="Debt Level" value={`${(e.debtToGdp * 100).toFixed(0)}% of GDP`} positive={e.debtToGdp < 0.6} />
          <Bar label="Sanction Resilience" value={e.sanctionResilience} max={100} color="bg-accent-amber" />
          <Bar label="Sanction Evasion" value={e.sanctionEvasion} max={100} color="bg-accent-blue" />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Economic Policy</h4>
          <ActionBtn
            label="Invest in Economy"
            cost="$10B"
            effect="GDP growth +1%"
            disabled={!canAct || e.budget < 10}
            onClick={() => act({ type: 'allocate_budget', category: 'economy', amount: 10 })}
          />
          <ActionBtn
            label="Raise Taxes (+5%)"
            cost="Approval -1.5"
            effect="Revenue +5%"
            disabled={!canAct || e.taxRate >= 0.95}
            onClick={() => act({ type: 'set_tax_rate', rate: Math.min(1, e.taxRate + 0.05) })}
          />
          <ActionBtn
            label="Lower Taxes (-5%)"
            cost="Revenue -5%"
            effect="Approval +1.5"
            disabled={!canAct || e.taxRate <= 0.05}
            onClick={() => act({ type: 'set_tax_rate', rate: Math.max(0, e.taxRate - 0.05) })}
          />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Sanction Evasion</h4>
          <ActionBtn
            label="Shadow Fleet"
            cost="$5B"
            effect="Evasion +15"
            disabled={!canAct || e.budget < 5}
            onClick={() => act({ type: 'sanction_evasion', method: 'shadow_fleet' })}
          />
          <ActionBtn
            label="Crypto Bypass"
            cost="$3B, Tech 5+"
            effect="Evasion +10"
            disabled={!canAct || e.budget < 3 || country.techLevel < 5}
            onClick={() => act({ type: 'sanction_evasion', method: 'crypto_bypass' })}
          />
          <ActionBtn
            label="Parallel Import"
            cost="$8B"
            effect="Evasion +20 (needs trade partner)"
            disabled={!canAct || e.budget < 8}
            onClick={() => act({ type: 'sanction_evasion', method: 'parallel_import' })}
          />
          <ActionBtn
            label="Import Substitution"
            cost="$20B"
            effect="Evasion +25, Resilience +10"
            disabled={!canAct || e.budget < 20}
            onClick={() => act({ type: 'sanction_evasion', method: 'import_substitution' })}
          />
        </div>
      </div>
    </div>
  );
}

function MilitaryTab({ country, canAct, onAction, targetCountryCode, playerCountryCode }: TabProps) {
  const m = country.military;
  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard label="Army" value={formatNum(m.army)} sub="Personnel" />
        <StatCard label="Navy" value={formatNum(m.navy)} sub="Vessels" />
        <StatCard label="Air Force" value={formatNum(m.airForce)} sub="Aircraft" />
        <StatCard label="Nuclear" value={m.nuclearWeapons.toString()} sub="Warheads" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Capabilities</h4>
          <Bar label="Defense Budget" value={m.defenseBudget} max={800} color="bg-accent-amber" />
          <Bar label="Tech Level" value={m.techLevel} max={10} color="bg-accent-blue" />
          <Bar label="Total Power" value={country.indexOfPower} max={100} color="bg-accent-red" />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Build Up</h4>
          <ActionBtn
            label="Recruit Infantry"
            cost="$5B"
            effect="Army +5K, Stability -1"
            disabled={!canAct || country.economy.budget < 5}
            onClick={() => act({ type: 'allocate_budget', category: 'military', amount: 5 })}
          />
          <ActionBtn
            label="Military R&D"
            cost="$10B"
            effect="Tech +0.3, ???"
            disabled={!canAct || country.economy.budget < 10}
            onClick={() => act({ type: 'research_tech', category: 'military' })}
          />
          <ActionBtn
            label="Arms Deal"
            cost="Sells weapons"
            effect="Revenue +$, Target army +"
            disabled={!canAct || !hasTarget || m.techLevel < 3}
            onClick={() => act({ type: 'arms_deal', targetCountry: targetCountryCode!, amount: 5 })}
          />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
            Operations {hasTarget ? `→ ${targetCountryCode}` : ''}
          </h4>
          <ActionBtn
            label="Surgical Airstrike"
            cost="$2B, 5 aircraft"
            effect="Target damaged, ???"
            disabled={!canAct || !hasTarget || m.airForce < 10 || country.economy.budget < 2}
            onClick={() => act({ type: 'airstrike', targetCountry: targetCountryCode!, intensity: 'surgical' })}
          />
          <ActionBtn
            label="Carpet Bombing"
            cost="$20B, 50 aircraft"
            effect="Massive damage, ???"
            disabled={!canAct || !hasTarget || m.airForce < 50 || country.economy.budget < 20}
            onClick={() => act({ type: 'airstrike', targetCountry: targetCountryCode!, intensity: 'carpet' })}
          />
          <ActionBtn
            label="Ground Invasion (25%)"
            cost="Budget + troops"
            effect="Capture territory, ???"
            disabled={!canAct || !hasTarget || m.army < 1000}
            onClick={() => act({ type: 'invasion', targetCountry: targetCountryCode!, committedForces: 0.25 })}
          />
          <ActionBtn
            label="Naval Blockade"
            cost="$5B, 20 vessels"
            effect="Target trade -$15B"
            disabled={!canAct || !hasTarget || m.navy < 20 || country.economy.budget < 5}
            onClick={() => act({ type: 'naval_blockade', targetCountry: targetCountryCode! })}
          />
        </div>
      </div>
    </div>
  );
}

function DiplomacyTab({ country, canAct, onAction, targetCountryCode, playerCountryCode }: TabProps) {
  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  // Diplomacy actions need a target country (different from self)
  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Influence" value={country.diplomaticInfluence.toFixed(0)} sub="Global standing" />
        <StatCard label="Power Index" value={country.indexOfPower.toFixed(1)} sub="Composite score" />
        <StatCard label="Relations" value="—" sub="Select target" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Status</h4>
          <Bar label="Diplomatic Influence" value={country.diplomaticInfluence} max={100} color="bg-accent-blue" />
          <EffectRow label="Target" value={hasTarget ? targetCountryCode! : 'Click a country'} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
            Actions {hasTarget ? `→ ${targetCountryCode}` : ''}
          </h4>
          <ActionBtn
            label="Propose Alliance"
            cost="Influence -5"
            effect="Mutual defense"
            disabled={!canAct || !hasTarget || country.diplomaticInfluence < 5}
            onClick={() => act({ type: 'propose_alliance', targetCountry: targetCountryCode! })}
          />
          <ActionBtn
            label="Declare War"
            cost="Stability -15"
            effect="Approval -10, ???"
            disabled={!canAct || !hasTarget}
            onClick={() => act({ type: 'declare_war', targetCountry: targetCountryCode! })}
          />
          <ActionBtn
            label="Impose Sanctions"
            cost="Influence -3"
            effect="Target GDP -0.5%"
            disabled={!canAct || !hasTarget || country.diplomaticInfluence < 3}
            onClick={() => act({ type: 'propose_sanction', targetCountry: targetCountryCode! })}
          />
          <ActionBtn
            label="Trade Agreement"
            cost="Influence -2"
            effect="Both GDP +0.3%"
            disabled={!canAct || !hasTarget || country.diplomaticInfluence < 2}
            onClick={() => act({ type: 'propose_trade', targetCountry: targetCountryCode!, resource: 'general', amount: 1 })}
          />
        </div>
      </div>
    </div>
  );
}

function IntelligenceTab({ country, canAct, onAction, targetCountryCode, playerCountryCode }: TabProps) {
  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Cyber Power" value={`${country.techLevel.toFixed(1)}/10`} sub="Tech-based" />
        <StatCard label="Influence" value={country.diplomaticInfluence.toFixed(0)} sub="Covert ops currency" />
        <StatCard label="Budget" value={`$${country.economy.budget.toFixed(0)}B`} sub="Available funds" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Research</h4>
          <ActionBtn
            label="Cyber Research"
            cost="$10B"
            effect="Cyber power +, ???"
            disabled={!canAct || country.economy.budget < 10}
            onClick={() => act({ type: 'research_tech', category: 'cyber' })}
          />
          <ActionBtn
            label="Space Program"
            cost="$10B"
            effect="Influence +2, ???"
            disabled={!canAct || country.economy.budget < 10}
            onClick={() => act({ type: 'research_tech', category: 'space' })}
          />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
            Covert Ops {hasTarget ? `→ ${targetCountryCode}` : ''}
          </h4>
          <ActionBtn
            label="Sabotage (Energy)"
            cost="$5B"
            effect="Blackouts, GDP -3%, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 5}
            onClick={() => act({ type: 'sabotage', targetCountry: targetCountryCode!, target: 'energy' })}
          />
          <ActionBtn
            label="Sabotage (Military)"
            cost="$5B"
            effect="Arms destroyed, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 5}
            onClick={() => act({ type: 'sabotage', targetCountry: targetCountryCode!, target: 'military' })}
          />
          <ActionBtn
            label="Cyber Attack"
            cost="$3B, Tech 3+"
            effect="Systems disrupted, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 3 || country.techLevel < 3}
            onClick={() => act({ type: 'cyber_attack', targetCountry: targetCountryCode!, target: 'financial' })}
          />
          <ActionBtn
            label="Incite Rebellion"
            cost="$8B, Infl. -3"
            effect="Revolt, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 8 || country.diplomaticInfluence < 3}
            onClick={() => act({ type: 'incite_rebellion', targetCountry: targetCountryCode! })}
          />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
            Black Ops {hasTarget ? `→ ${targetCountryCode}` : ''}
          </h4>
          <ActionBtn
            label="Proxy War"
            cost="$10B+, Infl. -5"
            effect="Fund rebels, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 10 || country.diplomaticInfluence < 5}
            onClick={() => act({ type: 'proxy_war', targetCountry: targetCountryCode!, funding: 10 })}
          />
          <ActionBtn
            label="Stage Coup"
            cost="$15B, Infl. -10"
            effect="Overthrow gov, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 15 || country.diplomaticInfluence < 10}
            onClick={() => act({ type: 'coup_attempt', targetCountry: targetCountryCode! })}
          />
          <ActionBtn
            label="Propaganda"
            cost="$3B"
            effect="Target destabilized, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 3}
            onClick={() => act({ type: 'propaganda', targetCountry: targetCountryCode!, narrative: 'anti_government' })}
          />
          <ActionBtn
            label="False Flag"
            cost="$12B, Infl. -8"
            effect="Frame another, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 12 || country.diplomaticInfluence < 8}
            onClick={() => act({ type: 'false_flag', targetCountry: targetCountryCode!, framedCountry: 'RU', operation: 'terrorist_attack' })}
          />
        </div>
      </div>
    </div>
  );
}

function DomesticTab({ country, canAct, onAction }: TabProps) {
  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const revRisk = country.stability < 40 ? 100 - country.stability : 0;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Stability" value={country.stability.toFixed(0)} sub={country.stability < 30 ? 'CRITICAL' : country.stability < 50 ? 'Unstable' : 'Stable'} />
        <StatCard label="Approval" value={`${country.approval.toFixed(0)}%`} sub="Population support" />
        <StatCard label="Tech Level" value={country.techLevel.toFixed(1)} sub="Research progress" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Indicators</h4>
          <Bar label="Stability" value={country.stability} max={100} color="bg-accent-green" />
          <Bar label="Approval" value={country.approval} max={100} color="bg-accent-blue" />
          <Bar label="Revolution Risk" value={revRisk} max={100} color="bg-severity-high" />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Policies</h4>
          <ActionBtn
            label="Social Spending"
            cost="$5B"
            effect="Approval +2.5, Stability +1.5"
            disabled={!canAct || country.economy.budget < 5}
            onClick={() => act({ type: 'allocate_budget', category: 'social', amount: 5 })}
          />
          <ActionBtn
            label="Research Program"
            cost="$10B"
            effect="Tech +0.3, ???"
            disabled={!canAct || country.economy.budget < 10}
            onClick={() => act({ type: 'research_tech', category: 'economy' })}
          />
          <ActionBtn
            label="Emergency Spending"
            cost="$15B"
            effect="Approval +7.5, Stability +4.5"
            disabled={!canAct || country.economy.budget < 15}
            onClick={() => act({ type: 'allocate_budget', category: 'social', amount: 15 })}
          />
        </div>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}
