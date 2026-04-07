'use client';

import { useState } from 'react';
import type { CountryState, PlayerAction, ResourceType, ResourceBalance } from '@conflict-game/shared-types';

// Intel constants inlined to avoid Turbopack .js extension resolution issues with shared-types
type SpyOpKey = 'humint' | 'sigint' | 'satellite' | 'cyber_espionage' | 'diplomatic_probe';
type IntelLevelKey = 'none' | 'low' | 'medium' | 'high' | 'full';

const SPY_OP_CONFIG_UI: Record<SpyOpKey, { cost: number; baseDuration: number; detectionRisk: number; reveals: string; techRequired: number; intelGain: number }> = {
  humint:           { cost: 8,  baseDuration: 6, detectionRisk: 0.12, reveals: 'military',  techRequired: 1, intelGain: 5 },
  sigint:           { cost: 12, baseDuration: 4, detectionRisk: 0.08, reveals: 'economy',   techRequired: 5, intelGain: 8 },
  satellite:        { cost: 15, baseDuration: 3, detectionRisk: 0.05, reveals: 'resources', techRequired: 6, intelGain: 6 },
  cyber_espionage:  { cost: 10, baseDuration: 5, detectionRisk: 0.15, reveals: 'stability', techRequired: 7, intelGain: 10 },
  diplomatic_probe: { cost: 3,  baseDuration: 2, detectionRisk: 0.03, reveals: 'diplomacy', techRequired: 1, intelGain: 3 },
};

const INTEL_THRESHOLDS_UI: Record<IntelLevelKey, number> = { none: 0, low: 25, medium: 60, high: 120, full: 200 };

const TABS = ['Economy', 'Military', 'Diplomacy', 'Intelligence', 'Research', 'Domestic'] as const;
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
  /** Whether this country has active sanctions against it */
  hasSanctions?: boolean;
}

export function BottomTabs({
  country,
  isNonPlayable,
  countryName,
  onAction,
  targetCountryCode,
  playerCountryCode,
  isGameActive,
  hasSanctions,
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
                  hasSanctions={hasSanctions}
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
  hasSanctions?: boolean;
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
    case 'Research':
      return <ResearchTab {...props} />;
    case 'Domestic':
      return <DomesticTab {...props} />;
  }
}

// ── Resource UI constants ──

const RESOURCE_CATEGORIES: { label: string; icon: string; resources: ResourceType[] }[] = [
  { label: 'Energy', icon: '\u26FD', resources: ['oil', 'gas', 'coal', 'refinedOil'] },
  { label: 'Industrial', icon: '\u2699', resources: ['iron', 'copper', 'aluminum', 'titanium', 'steel'] },
  { label: 'Precious', icon: '\u2B50', resources: ['gold', 'silver', 'palladium', 'platinum'] },
  { label: 'Luxury', icon: '\u2666', resources: ['diamonds', 'gemstones', 'luxuryGoods'] },
  { label: 'Strategic', icon: '\u26A0', resources: ['rareEarth', 'lithium', 'cobalt'] },
  { label: 'Nuclear', icon: '\u2622', resources: ['uranium', 'nuclearFuel'] },
  { label: 'Forestry', icon: '\u{1F332}', resources: ['timber', 'rareWood'] },
  { label: 'Agriculture', icon: '\u{1F33E}', resources: ['wheat', 'rice', 'fish', 'freshWater', 'fertilizer'] },
  { label: 'Advanced', icon: '\u{1F4BB}', resources: ['electronics', 'semiconductors', 'weaponsComponents', 'pharmaceuticals'] },
];

const RESOURCE_LABELS: Record<string, string> = {
  oil: 'Oil', gas: 'Gas', coal: 'Coal', iron: 'Iron', copper: 'Copper',
  aluminum: 'Aluminum', titanium: 'Titanium', gold: 'Gold', silver: 'Silver',
  palladium: 'Palladium', platinum: 'Platinum', diamonds: 'Diamonds',
  gemstones: 'Gems', rareEarth: 'Rare Earth', lithium: 'Lithium',
  cobalt: 'Cobalt', uranium: 'Uranium', timber: 'Timber', rareWood: 'Rare Wood',
  wheat: 'Wheat', rice: 'Rice', fish: 'Fish', freshWater: 'Water',
  steel: 'Steel', electronics: 'Electronics', semiconductors: 'Semicon.',
  refinedOil: 'Refined Oil', nuclearFuel: 'Nuclear Fuel',
  luxuryGoods: 'Luxury', weaponsComponents: 'Weapons', pharmaceuticals: 'Pharma',
  fertilizer: 'Fertilizer',
};

const ECON_SUB_TABS = ['Overview', 'Resources', 'Policy'] as const;
type EconSubTab = (typeof ECON_SUB_TABS)[number];

function EconomyTab({ country, canAct, onAction, hasSanctions }: TabProps) {
  const e = country.economy;
  const [subTab, setSubTab] = useState<EconSubTab>('Overview');

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <StatCard label="GDP" value={`$${(e.gdp / 1000).toFixed(1)}T`} sub={`Growth: ${e.gdpGrowth.toFixed(1)}%`} />
        <StatCard label="Budget" value={`$${e.budget.toFixed(0)}B`} sub={`Tax rate: ${(e.taxRate * 100).toFixed(0)}%`} />
        <StatCard label="Inflation" value={`${e.inflation.toFixed(1)}%`} sub={e.inflation > 5 ? 'High' : 'Stable'} />
        <StatCard label="Debt/GDP" value={`${(e.debtToGdp * 100).toFixed(0)}%`} sub={`Trade: ${e.tradeBalance > 0 ? '+' : ''}${e.tradeBalance.toFixed(0)}B`} />
      </div>

      {/* Resource shock indicator */}
      {e.resourceShockMultiplier > 1.05 && (
        <div className="bg-severity-high/20 border border-severity-high/40 rounded px-3 py-1.5 mb-3 text-xs text-severity-high">
          Resource shock: x{e.resourceShockMultiplier.toFixed(2)} — deficits are slowing GDP growth
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-3 border-b border-border-default pb-1">
        {ECON_SUB_TABS.map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-3 py-1 text-xs font-bold uppercase rounded-t transition-colors ${
              subTab === t
                ? 'bg-bg-card text-text-primary border border-border-default border-b-0'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === 'Overview' && <EconOverviewSub country={country} />}
      {subTab === 'Resources' && <EconResourcesSub country={country} canAct={canAct} act={act} />}
      {subTab === 'Policy' && <EconPolicySub country={country} canAct={canAct} act={act} hasSanctions={hasSanctions} />}
    </div>
  );
}

function EconOverviewSub({ country }: { country: CountryState }) {
  const e = country.economy;
  const rs = country.resourceState ?? {};

  // Find top deficits
  const deficits = Object.entries(rs)
    .filter(([, b]) => b && b.deficit > 0)
    .sort(([, a], [, b]) => (b?.deficit ?? 0) - (a?.deficit ?? 0))
    .slice(0, 5);

  // Find top surpluses (production > consumption)
  const surpluses = Object.entries(rs)
    .filter(([, b]) => b && b.production > b.consumption + b.exported)
    .sort(([, a], [, b]) => {
      const surpA = (a?.production ?? 0) - (a?.consumption ?? 0) - (a?.exported ?? 0);
      const surpB = (b?.production ?? 0) - (b?.consumption ?? 0) - (b?.exported ?? 0);
      return surpB - surpA;
    })
    .slice(0, 5);

  return (
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
        <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Top Deficits</h4>
        {deficits.length === 0 ? (
          <p className="text-text-muted text-xs">No resource deficits</p>
        ) : (
          deficits.map(([r, b]) => (
            <EffectRow
              key={r}
              label={RESOURCE_LABELS[r] ?? r}
              value={`-${(b?.deficit ?? 0).toFixed(1)}/mo`}
              positive={false}
            />
          ))
        )}
      </div>
      <div>
        <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Top Surpluses</h4>
        {surpluses.length === 0 ? (
          <p className="text-text-muted text-xs">No resource surpluses</p>
        ) : (
          surpluses.map(([r, b]) => {
            const surplus = (b?.production ?? 0) - (b?.consumption ?? 0) - (b?.exported ?? 0);
            return (
              <EffectRow
                key={r}
                label={RESOURCE_LABELS[r] ?? r}
                value={`+${surplus.toFixed(1)}/mo`}
                positive={true}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function EconResourcesSub({ country, canAct, act }: { country: CountryState; canAct: boolean; act: (a: PlayerAction) => void }) {
  const rs = country.resourceState ?? {};

  return (
    <div className="space-y-3">
      {/* Stockpile action */}
      {canAct && (
        <div className="flex gap-2 mb-2">
          <ActionBtn
            label="Build Stockpile (3mo)"
            cost="$ varies"
            effect="Reserves +3 months"
            disabled={!canAct || country.economy.budget < 5}
            onClick={() => act({ type: 'build_stockpile', resource: 'oil', months: 3 })}
          />
          <ActionBtn
            label="Build Stockpile (6mo)"
            cost="$ varies"
            effect="Reserves +6 months"
            disabled={!canAct || country.economy.budget < 10}
            onClick={() => act({ type: 'build_stockpile', resource: 'oil', months: 6 })}
          />
        </div>
      )}

      {/* Resource table by category */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase border-b border-border-default">
              <th className="text-left py-1 pr-2">Resource</th>
              <th className="text-right px-1">Prod</th>
              <th className="text-right px-1">Cons</th>
              <th className="text-right px-1">Import</th>
              <th className="text-right px-1">Export</th>
              <th className="text-right px-1">Deficit</th>
              <th className="text-right pl-1">Stock</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCE_CATEGORIES.map(cat => {
              const hasAny = cat.resources.some(r => {
                const b = rs[r];
                return b && (b.production > 0 || b.consumption > 0 || b.imported > 0 || b.deficit > 0);
              });
              if (!hasAny) return null;
              return [
                <tr key={`cat-${cat.label}`}>
                  <td colSpan={7} className="pt-2 pb-1 text-text-secondary font-bold uppercase">
                    {cat.icon} {cat.label}
                  </td>
                </tr>,
                ...cat.resources.map(r => {
                  const b: ResourceBalance | undefined = rs[r];
                  if (!b || (b.production === 0 && b.consumption === 0 && b.imported === 0)) return null;
                  const hasDeficit = b.deficit > 0;
                  return (
                    <tr key={r} className={`border-b border-border-default/30 ${hasDeficit ? 'bg-severity-high/10' : ''}`}>
                      <td className="py-0.5 pr-2 text-text-primary">{RESOURCE_LABELS[r] ?? r}</td>
                      <td className="text-right px-1 font-mono text-accent-green">{b.production > 0 ? b.production.toFixed(1) : '-'}</td>
                      <td className="text-right px-1 font-mono text-text-secondary">{b.consumption > 0 ? b.consumption.toFixed(1) : '-'}</td>
                      <td className="text-right px-1 font-mono text-accent-blue">{b.imported > 0 ? b.imported.toFixed(1) : '-'}</td>
                      <td className="text-right px-1 font-mono text-accent-amber">{b.exported > 0 ? b.exported.toFixed(1) : '-'}</td>
                      <td className={`text-right px-1 font-mono ${hasDeficit ? 'text-severity-high font-bold' : 'text-text-muted'}`}>
                        {hasDeficit ? `-${b.deficit.toFixed(1)}` : '-'}
                      </td>
                      <td className="text-right pl-1 font-mono text-text-secondary">
                        {b.stockpile > 0 ? `${b.stockpile.toFixed(1)}mo` : '-'}
                      </td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Processing capabilities */}
      {country.processingCapabilities.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-1">Processing Capabilities</h4>
          <div className="flex flex-wrap gap-1">
            {country.processingCapabilities.map(p => (
              <span key={p} className="bg-bg-card border border-border-default rounded px-2 py-0.5 text-xs text-accent-blue">
                {RESOURCE_LABELS[p] ?? p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EconPolicySub({ country, canAct, act, hasSanctions }: { country: CountryState; canAct: boolean; act: (a: PlayerAction) => void; hasSanctions?: boolean }) {
  const e = country.economy;

  return (
    <div className={`grid ${hasSanctions ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
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
      {hasSanctions && (
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
      )}
      <div>
        <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Price Manipulation</h4>
        <ActionBtn
          label="Production Cut (OPEC)"
          cost="Production -30%"
          effect="Price +20-40% ???"
          disabled={!canAct}
          onClick={() => act({ type: 'manipulate_price', resource: 'oil', direction: 'increase', method: 'production_cut' })}
        />
        <ActionBtn
          label="Dump Stockpile"
          cost="Stockpile depleted"
          effect="Price -15-30% ???"
          disabled={!canAct}
          onClick={() => act({ type: 'manipulate_price', resource: 'oil', direction: 'decrease', method: 'dump_stockpile' })}
        />
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

// Resources available for trade (most relevant ones)
const TRADEABLE_RESOURCES: { resource: ResourceType; label: string }[] = [
  { resource: 'oil', label: 'Oil' }, { resource: 'gas', label: 'Gas' },
  { resource: 'coal', label: 'Coal' }, { resource: 'iron', label: 'Iron' },
  { resource: 'copper', label: 'Copper' }, { resource: 'aluminum', label: 'Aluminum' },
  { resource: 'titanium', label: 'Titanium' }, { resource: 'gold', label: 'Gold' },
  { resource: 'rareEarth', label: 'Rare Earth' }, { resource: 'lithium', label: 'Lithium' },
  { resource: 'uranium', label: 'Uranium' }, { resource: 'wheat', label: 'Wheat' },
  { resource: 'rice', label: 'Rice' }, { resource: 'timber', label: 'Timber' },
  { resource: 'steel', label: 'Steel' }, { resource: 'electronics', label: 'Electronics' },
  { resource: 'semiconductors', label: 'Semicon.' }, { resource: 'refinedOil', label: 'Ref. Oil' },
  { resource: 'weaponsComponents', label: 'Weapons' }, { resource: 'pharmaceuticals', label: 'Pharma' },
];

function DiplomacyTab({ country, canAct, onAction, targetCountryCode, playerCountryCode }: TabProps) {
  const [showTrade, setShowTrade] = useState(false);
  const [tradeOffers, setTradeOffers] = useState<Record<string, number>>({});
  const [tradeRequests, setTradeRequests] = useState<Record<string, number>>({});

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;

  const sendTrade = () => {
    if (!hasTarget) return;
    const offers = Object.entries(tradeOffers)
      .filter(([, amt]) => amt > 0)
      .map(([resource, amount]) => ({ resource: resource as ResourceType, amount }));
    const requests = Object.entries(tradeRequests)
      .filter(([, amt]) => amt > 0)
      .map(([resource, amount]) => ({ resource: resource as ResourceType, amount }));
    if (offers.length === 0 && requests.length === 0) return;
    act({ type: 'propose_trade', targetCountry: targetCountryCode!, offers, requests, duration: 12 });
    setTradeOffers({});
    setTradeRequests({});
    setShowTrade(false);
  };

  // Get player's surpluses and deficits for trade hints
  const rs = country.resourceState ?? {};

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Influence" value={country.diplomaticInfluence.toFixed(0)} sub="Global standing" />
        <StatCard label="Power Index" value={country.indexOfPower.toFixed(1)} sub="Composite score" />
        <StatCard label="Relations" value="—" sub="Select target" />
      </div>

      {!showTrade ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Status</h4>
            <Bar label="Diplomatic Influence" value={country.diplomaticInfluence} max={100} color="bg-accent-blue" />
            <EffectRow label="Target" value={hasTarget ? targetCountryCode! : 'Click a country'} />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
              Actions {hasTarget ? `\u2192 ${targetCountryCode}` : ''}
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
              effect="Open trade panel"
              disabled={!canAct || !hasTarget || country.diplomaticInfluence < 2}
              onClick={() => setShowTrade(true)}
            />
          </div>
        </div>
      ) : (
        /* ── Trade Panel (Civ-style) ── */
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase text-text-secondary">
              Trade with {targetCountryCode}
            </h4>
            <button onClick={() => setShowTrade(false)} className="text-text-muted hover:text-text-primary text-xs">
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* YOU OFFER */}
            <div>
              <h5 className="text-xs font-bold text-accent-green mb-2">You Offer (surplus)</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {TRADEABLE_RESOURCES.map(({ resource, label }) => {
                  const bal = rs[resource];
                  const surplus = bal ? bal.production - bal.consumption : 0;
                  if (surplus <= 0) return null;
                  return (
                    <div key={resource} className="flex items-center justify-between bg-bg-card rounded px-2 py-1">
                      <span className="text-text-secondary text-xs">{label}</span>
                      <span className="text-text-muted text-[10px]">+{surplus.toFixed(1)}</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.floor(surplus)}
                        step={1}
                        value={tradeOffers[resource] ?? 0}
                        onChange={e => setTradeOffers(prev => ({ ...prev, [resource]: Math.max(0, Number(e.target.value)) }))}
                        className="w-12 bg-bg-primary border border-border-default rounded px-1 py-0.5 text-xs text-text-primary font-mono text-right"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {/* YOU REQUEST */}
            <div>
              <h5 className="text-xs font-bold text-severity-high mb-2">You Request (deficit)</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {TRADEABLE_RESOURCES.map(({ resource, label }) => {
                  const bal = rs[resource];
                  const deficit = bal ? bal.deficit : 0;
                  if (deficit <= 0) return null;
                  return (
                    <div key={resource} className="flex items-center justify-between bg-bg-card rounded px-2 py-1">
                      <span className="text-text-secondary text-xs">{label}</span>
                      <span className="text-text-muted text-[10px]">-{deficit.toFixed(1)}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={tradeRequests[resource] ?? 0}
                        onChange={e => setTradeRequests(prev => ({ ...prev, [resource]: Math.max(0, Number(e.target.value)) }))}
                        className="w-12 bg-bg-primary border border-border-default rounded px-1 py-0.5 text-xs text-text-primary font-mono text-right"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <button
            onClick={sendTrade}
            disabled={Object.values(tradeOffers).every(v => !v) && Object.values(tradeRequests).every(v => !v)}
            className="mt-3 w-full bg-accent-red hover:bg-accent-red/80 disabled:bg-bg-card disabled:opacity-50 text-text-primary text-sm font-bold py-2 rounded transition-colors"
          >
            SEND TRADE PROPOSAL (12 months)
          </button>
        </div>
      )}
    </div>
  );
}

const INTEL_LEVEL_COLORS: Record<IntelLevelKey, string> = {
  none: 'text-text-muted',
  low: 'text-severity-low',
  medium: 'text-accent-amber',
  high: 'text-accent-green',
  full: 'text-accent-blue',
};

const SPY_OP_LABELS: Record<SpyOpKey, string> = {
  humint: 'HUMINT Agent',
  sigint: 'SIGINT Intercept',
  satellite: 'Satellite Recon',
  cyber_espionage: 'Cyber Espionage',
  diplomatic_probe: 'Diplomatic Probe',
};

function IntelligenceTab({ country, canAct, onAction, targetCountryCode, playerCountryCode }: TabProps) {
  const [intelSub, setIntelSub] = useState<'overview' | 'dossiers' | 'ops' | 'covert'>('overview');
  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;
  const intel = country.intel;

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const subTabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'dossiers' as const, label: 'Dossiers' },
    { key: 'ops' as const, label: 'Spy Ops' },
    { key: 'covert' as const, label: 'Covert Ops' },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-3 border-b border-border-default pb-2">
        {subTabs.map(st => (
          <button key={st.key} onClick={() => setIntelSub(st.key)}
            className={`text-xs px-2 py-1 rounded ${intelSub === st.key ? 'bg-accent-red/20 text-accent-red font-bold' : 'text-text-muted hover:text-text-primary'}`}>
            {st.label}
          </button>
        ))}
      </div>

      {intelSub === 'overview' && <IntelOverviewSub country={country} intel={intel} canAct={canAct} act={act} />}
      {intelSub === 'dossiers' && <IntelDossiersSub country={country} intel={intel} />}
      {intelSub === 'ops' && <IntelOpsSub country={country} intel={intel} canAct={canAct} act={act} hasTarget={!!hasTarget} targetCountryCode={targetCountryCode} />}
      {intelSub === 'covert' && <IntelCovertSub country={country} canAct={canAct} act={act} hasTarget={!!hasTarget} targetCountryCode={targetCountryCode} />}
    </div>
  );
}

function IntelOverviewSub({ country, intel, canAct, act }: { country: CountryState; intel: CountryState['intel']; canAct: boolean; act: (a: PlayerAction) => void }) {
  const counterIntel = intel?.counterIntel ?? 0;
  const intelBudget = intel?.intelBudget ?? 0;
  const activeOpsCount = intel ? Object.values(intel.dossiers).reduce((n, d) => n + d.activeOps.length, 0) : 0;
  const disinfoCount = intel?.disinfo.length ?? 0;
  const dossierCount = intel ? Object.keys(intel.dossiers).length : 0;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard label="Counter-Intel" value={counterIntel.toFixed(0)} sub={counterIntel > 60 ? 'Strong' : counterIntel > 30 ? 'Moderate' : 'Weak'} />
        <StatCard label="Intel Budget" value={`$${intelBudget.toFixed(0)}B/mo`} sub="Monthly cost" />
        <StatCard label="Active Ops" value={String(activeOpsCount)} sub={`${dossierCount} targets` } />
        <StatCard label="Disinfo" value={String(disinfoCount)} sub="Active campaigns" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Defense</h4>
          <Bar label="Counter-Intelligence" value={counterIntel} max={100} color="bg-accent-blue" />
          <ActionBtn label="Boost Counter-Intel (+$5B)" cost="$5B" effect="CI +10, detect spies"
            disabled={!canAct || country.economy.budget < 5}
            onClick={() => act({ type: 'boost_counter_intel', amount: 5 })} />
          <ActionBtn label="Boost Counter-Intel (+$15B)" cost="$15B" effect="CI +30, strong defense"
            disabled={!canAct || country.economy.budget < 15}
            onClick={() => act({ type: 'boost_counter_intel', amount: 15 })} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Intel Budget</h4>
          <div className="flex gap-1 mb-2">
            {[0, 2, 5, 10, 20].map(b => (
              <button key={b} onClick={() => act({ type: 'set_intel_budget', budget: b })}
                disabled={!canAct}
                className={`flex-1 text-xs py-1 rounded border transition-colors ${
                  intelBudget === b ? 'border-accent-red bg-accent-red/20 text-accent-red' : 'border-border-default text-text-muted hover:text-text-primary'
                } ${!canAct ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                ${b}B
              </button>
            ))}
          </div>
          <p className="text-text-muted text-xs">Intel budget is deducted from national budget each tick. Higher budget improves spy op effectiveness.</p>
        </div>
      </div>
    </div>
  );
}

function IntelDossiersSub({ country, intel }: { country: CountryState; intel: CountryState['intel'] }) {
  const dossiers = intel?.dossiers ?? {};
  const entries = Object.entries(dossiers);

  if (entries.length === 0) {
    return <p className="text-text-muted text-sm">No intelligence gathered yet. Launch spy operations to build dossiers on other countries.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([code, dossier]) => {
        const levelColor = INTEL_LEVEL_COLORS[dossier.level as IntelLevelKey];
        const nextThreshold = dossier.level === 'full' ? null
          : dossier.level === 'high' ? INTEL_THRESHOLDS_UI.full
          : dossier.level === 'medium' ? INTEL_THRESHOLDS_UI.high
          : dossier.level === 'low' ? INTEL_THRESHOLDS_UI.medium
          : INTEL_THRESHOLDS_UI.low;
        const progress = nextThreshold ? (dossier.intelPoints / nextThreshold) * 100 : 100;
        const revealed = dossier.revealed;

        return (
          <div key={code} className="bg-bg-card border border-border-default rounded p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-text-primary text-sm font-bold">{code}</span>
              <span className={`text-xs font-bold uppercase ${levelColor}`}>
                {dossier.level} ({dossier.intelPoints} pts)
              </span>
            </div>
            <div className="h-1 bg-bg-secondary rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-accent-blue rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['economy', 'military', 'resources', 'stability', 'diplomacy'] as const).map(cat => (
                <span key={cat} className={`text-xs px-1.5 py-0.5 rounded ${
                  revealed[cat] ? 'bg-accent-green/20 text-accent-green' : 'bg-bg-secondary text-text-muted'
                }`}>
                  {revealed[cat] ? '\u2713' : '?'} {cat}
                </span>
              ))}
            </div>
            {dossier.activeOps.length > 0 && (
              <div className="mt-1.5 text-xs text-text-muted">
                Active ops: {dossier.activeOps.map(op => SPY_OP_LABELS[op.type as SpyOpKey]).join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IntelOpsSub({ country, intel, canAct, act, hasTarget, targetCountryCode }: {
  country: CountryState; intel: CountryState['intel']; canAct: boolean; act: (a: PlayerAction) => void; hasTarget: boolean; targetCountryCode?: string | null;
}) {
  const spyOps: { key: SpyOpKey; label: string }[] = [
    { key: 'humint', label: 'HUMINT Agent' },
    { key: 'sigint', label: 'SIGINT Intercept' },
    { key: 'satellite', label: 'Satellite Recon' },
    { key: 'cyber_espionage', label: 'Cyber Espionage' },
    { key: 'diplomatic_probe', label: 'Diplomatic Probe' },
  ];

  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
        Launch Spy Operation {hasTarget ? <span className="text-accent-red">→ {targetCountryCode}</span> : <span className="text-text-muted">(select target on globe)</span>}
      </h4>
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {spyOps.map(({ key, label }) => {
          const cfg = SPY_OP_CONFIG_UI[key];
          const techOk = (country.techLevel ?? 1) >= cfg.techRequired;
          const budgetOk = country.economy.budget >= cfg.cost;
          return (
            <ActionBtn key={key} label={label}
              cost={`$${cfg.cost}B${cfg.techRequired > 1 ? `, Tech ${cfg.techRequired}+` : ''}`}
              effect={`${cfg.baseDuration}mo, reveals ${cfg.reveals}, risk ${(cfg.detectionRisk * 100).toFixed(0)}%`}
              disabled={!canAct || !hasTarget || !techOk || !budgetOk}
              onClick={() => act({ type: 'launch_spy_op', targetCountry: targetCountryCode!, opType: key as any })} />
          );
        })}
      </div>

      <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Disinformation Campaigns</h4>
      <p className="text-text-muted text-xs mb-2">Make your own data appear different to enemy spies.</p>
      <div className="grid grid-cols-3 gap-1.5">
        {(['economy', 'military', 'stability'] as const).map(cat => {
          const existing = intel?.disinfo.find(d => d.category === cat);
          return (
            <div key={cat} className="bg-bg-card border border-border-default rounded p-2">
              <div className="text-xs font-bold text-text-secondary uppercase mb-1">{cat}</div>
              {existing ? (
                <div className="text-xs text-accent-amber">
                  Active: x{existing.multiplier.toFixed(1)} ({existing.duration}mo)
                </div>
              ) : (
                <div className="flex gap-1">
                  <button disabled={!canAct} onClick={() => act({ type: 'launch_disinfo', category: cat, multiplier: 1.5, duration: 6 })}
                    className={`text-xs px-1 py-0.5 rounded border border-border-default ${!canAct ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-hover cursor-pointer'} text-accent-green`}>
                    +50%
                  </button>
                  <button disabled={!canAct} onClick={() => act({ type: 'launch_disinfo', category: cat, multiplier: 0.6, duration: 6 })}
                    className={`text-xs px-1 py-0.5 rounded border border-border-default ${!canAct ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-hover cursor-pointer'} text-severity-high`}>
                    -40%
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntelCovertSub({ country, canAct, act, hasTarget, targetCountryCode }: {
  country: CountryState; canAct: boolean; act: (a: PlayerAction) => void; hasTarget: boolean; targetCountryCode?: string | null;
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
            Covert Ops {hasTarget ? `→ ${targetCountryCode}` : ''}
          </h4>
          <ActionBtn label="Sabotage (Energy)" cost="$5B" effect="Blackouts, GDP -3%, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 5}
            onClick={() => act({ type: 'sabotage', targetCountry: targetCountryCode!, target: 'energy' })} />
          <ActionBtn label="Sabotage (Military)" cost="$5B" effect="Arms destroyed, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 5}
            onClick={() => act({ type: 'sabotage', targetCountry: targetCountryCode!, target: 'military' })} />
          <ActionBtn label="Cyber Attack" cost="$3B, Tech 3+" effect="Systems disrupted, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 3 || country.techLevel < 3}
            onClick={() => act({ type: 'cyber_attack', targetCountry: targetCountryCode!, target: 'financial' })} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Destabilization</h4>
          <ActionBtn label="Incite Rebellion" cost="$8B, Infl. -3" effect="Revolt, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 8 || country.diplomaticInfluence < 3}
            onClick={() => act({ type: 'incite_rebellion', targetCountry: targetCountryCode! })} />
          <ActionBtn label="Propaganda" cost="$3B" effect="Target destabilized, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 3}
            onClick={() => act({ type: 'propaganda', targetCountry: targetCountryCode!, narrative: 'anti_government' })} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">Black Ops</h4>
          <ActionBtn label="Proxy War" cost="$10B+, Infl. -5" effect="Fund rebels, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 10 || country.diplomaticInfluence < 5}
            onClick={() => act({ type: 'proxy_war', targetCountry: targetCountryCode!, funding: 10 })} />
          <ActionBtn label="Stage Coup" cost="$15B, Infl. -10" effect="Overthrow gov, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 15 || country.diplomaticInfluence < 10}
            onClick={() => act({ type: 'coup_attempt', targetCountry: targetCountryCode! })} />
          <ActionBtn label="False Flag" cost="$12B, Infl. -8" effect="Frame another, ???"
            disabled={!canAct || !hasTarget || country.economy.budget < 12 || country.diplomaticInfluence < 8}
            onClick={() => act({ type: 'false_flag', targetCountry: targetCountryCode!, framedCountry: 'RU', operation: 'terrorist_attack' })} />
        </div>
      </div>
    </div>
  );
}

// ── Tech Tree UI constants (inlined for Turbopack compat) ──

type TechBranchKey = 'military' | 'economic' | 'cyber' | 'space' | 'biotech' | 'infrastructure';

const BRANCH_META: { key: TechBranchKey; label: string; icon: string }[] = [
  { key: 'military', label: 'Military', icon: '\u2694\uFE0F' },
  { key: 'economic', label: 'Economic', icon: '\u{1F4B0}' },
  { key: 'cyber', label: 'Cyber', icon: '\u{1F4BB}' },
  { key: 'space', label: 'Space', icon: '\u{1F680}' },
  { key: 'biotech', label: 'Biotech', icon: '\u{1F9EC}' },
  { key: 'infrastructure', label: 'Infra', icon: '\u{1F3D7}\uFE0F' },
];

interface TechDefUI { id: string; branch: TechBranchKey; tier: number; name: string; icon: string; cost: number; researchTicks: number; prerequisites: string[]; effectDesc: string[] }

const TECH_TREE_UI: TechDefUI[] = [
  // Military
  { id: 'mil_1', branch: 'military', tier: 1, name: 'Advanced Infantry', icon: '\u{1F3AF}', cost: 5, researchTicks: 3, prerequisites: [], effectDesc: ['Attack +10%'] },
  { id: 'mil_2', branch: 'military', tier: 2, name: 'Mechanized Warfare', icon: '\u{1F69C}', cost: 10, researchTicks: 5, prerequisites: ['mil_1'], effectDesc: ['Attack +15%', 'Defense +10%'] },
  { id: 'mil_3', branch: 'military', tier: 3, name: 'Drone Warfare', icon: '\u{1F681}', cost: 15, researchTicks: 6, prerequisites: ['mil_2'], effectDesc: ['Attack +20%', 'Intel +2'] },
  { id: 'mil_4', branch: 'military', tier: 4, name: 'Hypersonic Missiles', icon: '\u{1F680}', cost: 25, researchTicks: 8, prerequisites: ['mil_3'], effectDesc: ['Attack +25%'] },
  { id: 'mil_5', branch: 'military', tier: 5, name: 'Stealth Technology', icon: '\u{1F47B}', cost: 30, researchTicks: 10, prerequisites: ['mil_4', 'cyber_2'], effectDesc: ['Defense +20%', 'Attack +15%'] },
  { id: 'mil_6', branch: 'military', tier: 6, name: 'Naval Supremacy', icon: '\u2693', cost: 35, researchTicks: 12, prerequisites: ['mil_5'], effectDesc: ['Attack +15%', 'Trade +10%'] },
  { id: 'mil_7', branch: 'military', tier: 7, name: 'Strategic Bombers', icon: '\u2708\uFE0F', cost: 40, researchTicks: 14, prerequisites: ['mil_6'], effectDesc: ['Attack +30%'] },
  { id: 'mil_8', branch: 'military', tier: 8, name: 'Nuclear Deterrent', icon: '\u2622\uFE0F', cost: 50, researchTicks: 18, prerequisites: ['mil_7', 'infra_4'], effectDesc: ['Defense +30%', 'Stability +0.5/tick'] },
  // Economic
  { id: 'econ_1', branch: 'economic', tier: 1, name: 'Digital Banking', icon: '\u{1F4B3}', cost: 5, researchTicks: 3, prerequisites: [], effectDesc: ['GDP +0.3%'] },
  { id: 'econ_2', branch: 'economic', tier: 2, name: 'Trade Automation', icon: '\u{1F4E6}', cost: 8, researchTicks: 4, prerequisites: ['econ_1'], effectDesc: ['Trade +15%'] },
  { id: 'econ_3', branch: 'economic', tier: 3, name: 'Special Economic Zones', icon: '\u{1F3ED}', cost: 12, researchTicks: 5, prerequisites: ['econ_2'], effectDesc: ['GDP +0.5%', 'Trade +10%'] },
  { id: 'econ_4', branch: 'economic', tier: 4, name: 'Green Energy', icon: '\u{1F33F}', cost: 20, researchTicks: 8, prerequisites: ['econ_3', 'infra_2'], effectDesc: ['Energy +20%', 'Stability +0.3/tick'] },
  { id: 'econ_5', branch: 'economic', tier: 5, name: 'Advanced Manufacturing', icon: '\u2699\uFE0F', cost: 25, researchTicks: 10, prerequisites: ['econ_4'], effectDesc: ['Industrial +25%', 'Unlocks weapons'] },
  { id: 'econ_6', branch: 'economic', tier: 6, name: 'Financial Instruments', icon: '\u{1F4C8}', cost: 30, researchTicks: 12, prerequisites: ['econ_5'], effectDesc: ['GDP +0.8%', 'Sanction res. +15'] },
  // Cyber
  { id: 'cyber_1', branch: 'cyber', tier: 1, name: 'Basic Encryption', icon: '\u{1F510}', cost: 5, researchTicks: 3, prerequisites: [], effectDesc: ['Counter-intel +5'] },
  { id: 'cyber_2', branch: 'cyber', tier: 2, name: 'Network Defense', icon: '\u{1F6E1}\uFE0F', cost: 10, researchTicks: 5, prerequisites: ['cyber_1'], effectDesc: ['Counter-intel +10', 'Cyber def +15%'] },
  { id: 'cyber_3', branch: 'cyber', tier: 3, name: 'Offensive Cyber', icon: '\u{1F5A5}\uFE0F', cost: 15, researchTicks: 7, prerequisites: ['cyber_2'], effectDesc: ['Unlocks cyber attacks', 'Cyber +3'] },
  { id: 'cyber_4', branch: 'cyber', tier: 4, name: 'AI Surveillance', icon: '\u{1F916}', cost: 20, researchTicks: 8, prerequisites: ['cyber_3'], effectDesc: ['Intel +5 per op', 'Cyber +3'] },
  { id: 'cyber_5', branch: 'cyber', tier: 5, name: 'Quantum Computing', icon: '\u{1F52E}', cost: 35, researchTicks: 12, prerequisites: ['cyber_4', 'econ_5'], effectDesc: ['Cyber +5', 'Intel +5', 'GDP +0.3%'] },
  { id: 'cyber_6', branch: 'cyber', tier: 6, name: 'Full Spectrum Cyber', icon: '\u26A1', cost: 45, researchTicks: 15, prerequisites: ['cyber_5'], effectDesc: ['Cyber +5', 'CI +15', 'Full cyber war'] },
  // Space
  { id: 'space_1', branch: 'space', tier: 1, name: 'Satellite Launch', icon: '\u{1F6F0}\uFE0F', cost: 10, researchTicks: 5, prerequisites: [], effectDesc: ['Intel +2'] },
  { id: 'space_2', branch: 'space', tier: 2, name: 'GPS Network', icon: '\u{1F4E1}', cost: 15, researchTicks: 6, prerequisites: ['space_1'], effectDesc: ['Accuracy +10%', 'Trade +5%'] },
  { id: 'space_3', branch: 'space', tier: 3, name: 'Space Reconnaissance', icon: '\u{1F52D}', cost: 20, researchTicks: 8, prerequisites: ['space_2'], effectDesc: ['Intel +5', 'Better sat ops'] },
  { id: 'space_4', branch: 'space', tier: 4, name: 'Anti-Satellite Weapons', icon: '\u{1F4A5}', cost: 30, researchTicks: 10, prerequisites: ['space_3', 'mil_4'], effectDesc: ['ASAT capability', 'Attack +15%'] },
  { id: 'space_5', branch: 'space', tier: 5, name: 'Space Station', icon: '\u{1F30D}', cost: 40, researchTicks: 14, prerequisites: ['space_4'], effectDesc: ['GDP +0.5%', 'Stability +0.5', 'Intel +3'] },
  // Biotech
  { id: 'bio_1', branch: 'biotech', tier: 1, name: 'Genetic Research', icon: '\u{1F9EC}', cost: 8, researchTicks: 4, prerequisites: [], effectDesc: ['Stability +0.2/tick'] },
  { id: 'bio_2', branch: 'biotech', tier: 2, name: 'Vaccine Programs', icon: '\u{1F489}', cost: 10, researchTicks: 5, prerequisites: ['bio_1'], effectDesc: ['Stability +0.3/tick', 'Approval +5'] },
  { id: 'bio_3', branch: 'biotech', tier: 3, name: 'Biodefense', icon: '\u{1F9EA}', cost: 15, researchTicks: 7, prerequisites: ['bio_2'], effectDesc: ['Bio defense +20%', 'Stability +0.2'] },
  { id: 'bio_4', branch: 'biotech', tier: 4, name: 'Agricultural Biotech', icon: '\u{1F33E}', cost: 18, researchTicks: 6, prerequisites: ['bio_3'], effectDesc: ['Food +30%', 'Better fertilizer'] },
  { id: 'bio_5', branch: 'biotech', tier: 5, name: 'Synthetic Biology', icon: '\u{1F52C}', cost: 35, researchTicks: 12, prerequisites: ['bio_4', 'cyber_4'], effectDesc: ['Pharma unlocked', 'GDP +0.5%', 'Industrial +15%'] },
  // Infrastructure
  { id: 'infra_1', branch: 'infrastructure', tier: 1, name: 'Power Grid', icon: '\u{1F50C}', cost: 8, researchTicks: 4, prerequisites: [], effectDesc: ['Energy +15%', 'GDP +0.2%'] },
  { id: 'infra_2', branch: 'infrastructure', tier: 2, name: 'Highway Network', icon: '\u{1F6E3}\uFE0F', cost: 12, researchTicks: 5, prerequisites: ['infra_1'], effectDesc: ['Trade +10%', 'GDP +0.3%'] },
  { id: 'infra_3', branch: 'infrastructure', tier: 3, name: '5G Deployment', icon: '\u{1F4F6}', cost: 15, researchTicks: 6, prerequisites: ['infra_2'], effectDesc: ['GDP +0.4%', 'Cyber +2'] },
  { id: 'infra_4', branch: 'infrastructure', tier: 4, name: 'Smart Cities', icon: '\u{1F3D9}\uFE0F', cost: 25, researchTicks: 8, prerequisites: ['infra_3', 'cyber_3'], effectDesc: ['Stability +0.4', 'GDP +0.5%', 'Approval +5'] },
  { id: 'infra_5', branch: 'infrastructure', tier: 5, name: 'Underground Bunkers', icon: '\u{1F3DA}\uFE0F', cost: 30, researchTicks: 10, prerequisites: ['infra_4'], effectDesc: ['Civilian def +25%', 'Stability +0.3'] },
  { id: 'infra_6', branch: 'infrastructure', tier: 6, name: 'Logistics Networks', icon: '\u{1F4E6}', cost: 35, researchTicks: 12, prerequisites: ['infra_5', 'econ_5'], effectDesc: ['All resources +15%', 'Trade +15%', 'Sanction res. +10'] },
];

function ResearchTab({ country, canAct, onAction }: TabProps) {
  const [selectedBranch, setSelectedBranch] = useState<TechBranchKey>('military');
  const tech = country.tech;
  const researched = tech?.researchedTechs ?? [];
  const activeResearch = tech?.activeResearch;

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const branchTechs = TECH_TREE_UI.filter(t => t.branch === selectedBranch).sort((a, b) => a.tier - b.tier);
  const totalResearched = researched.length;

  const getTechStatus = (t: TechDefUI): 'completed' | 'researching' | 'available' | 'locked' => {
    if (researched.includes(t.id)) return 'completed';
    if (activeResearch?.techId === t.id) return 'researching';
    if (t.prerequisites.every(p => researched.includes(p))) return 'available';
    return 'locked';
  };

  return (
    <div>
      {/* Active research banner */}
      {activeResearch && (
        <div className="bg-accent-amber/10 border border-accent-amber/30 rounded p-2 mb-3 flex items-center justify-between">
          <div>
            <span className="text-accent-amber text-xs font-bold uppercase">Researching: </span>
            <span className="text-text-primary text-sm font-bold">
              {TECH_TREE_UI.find(t => t.id === activeResearch.techId)?.name ?? activeResearch.techId}
            </span>
            <span className="text-text-muted text-xs ml-2">
              {activeResearch.ticksRemaining}/{activeResearch.totalTicks} months remaining
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-bg-card rounded-full overflow-hidden">
              <div className="h-full bg-accent-amber rounded-full transition-all"
                style={{ width: `${((activeResearch.totalTicks - activeResearch.ticksRemaining) / activeResearch.totalTicks) * 100}%` }} />
            </div>
            <button disabled={!canAct}
              onClick={() => act({ type: 'cancel_research' })}
              className={`text-xs px-2 py-0.5 rounded border border-severity-high/50 text-severity-high ${!canAct ? 'opacity-50' : 'hover:bg-severity-high/20 cursor-pointer'}`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Branch selector */}
      <div className="flex gap-1 mb-3">
        {BRANCH_META.map(b => {
          const branchTechIds = TECH_TREE_UI.filter(t => t.branch === b.key);
          const done = branchTechIds.filter(t => researched.includes(t.id)).length;
          return (
            <button key={b.key} onClick={() => setSelectedBranch(b.key)}
              className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                selectedBranch === b.key
                  ? 'border-accent-red bg-accent-red/20 text-accent-red font-bold'
                  : 'border-border-default text-text-muted hover:text-text-primary'
              }`}>
              {b.icon} {b.label}
              <span className="ml-1 text-text-muted">{done}/{branchTechIds.length}</span>
            </button>
          );
        })}
      </div>

      {/* Stats bar */}
      <div className="flex justify-between text-xs text-text-muted mb-2">
        <span>Total: {totalResearched}/{TECH_TREE_UI.length} techs</span>
        <span>Tech Level: {country.techLevel.toFixed(0)}/10</span>
      </div>

      {/* Tech list for selected branch */}
      <div className="space-y-1.5">
        {branchTechs.map(t => {
          const status = getTechStatus(t);
          const canStart = status === 'available' && !activeResearch && canAct && country.economy.budget >= t.cost;
          const missingPrereqs = t.prerequisites.filter(p => !researched.includes(p));

          return (
            <div key={t.id} className={`flex items-center gap-2 border rounded p-2 transition-colors ${
              status === 'completed' ? 'border-accent-green/40 bg-accent-green/5' :
              status === 'researching' ? 'border-accent-amber/40 bg-accent-amber/5 animate-pulse' :
              status === 'available' ? 'border-border-default bg-bg-card' :
              'border-border-default/50 bg-bg-card/50 opacity-60'
            }`}>
              <span className="text-lg">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${status === 'completed' ? 'text-accent-green' : status === 'researching' ? 'text-accent-amber' : 'text-text-primary'}`}>
                    {t.name}
                  </span>
                  {status === 'completed' && <span className="text-accent-green text-xs">{'\u2713'}</span>}
                  {status === 'researching' && <span className="text-accent-amber text-xs">...</span>}
                  {status === 'locked' && missingPrereqs.length > 0 && (
                    <span className="text-text-muted text-xs">
                      Needs: {missingPrereqs.map(p => TECH_TREE_UI.find(x => x.id === p)?.name ?? p).join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted truncate">
                  {t.effectDesc.join(' \u2022 ')}
                </div>
              </div>
              <div className="text-right shrink-0">
                {status === 'completed' ? (
                  <span className="text-accent-green text-xs font-bold">DONE</span>
                ) : status === 'researching' ? (
                  <span className="text-accent-amber text-xs">{activeResearch?.ticksRemaining}mo</span>
                ) : (
                  <div className="text-right">
                    <div className="text-xs text-accent-amber">${t.cost}B</div>
                    <div className="text-xs text-text-muted">{t.researchTicks}mo</div>
                  </div>
                )}
              </div>
              {canStart && (
                <button onClick={() => act({ type: 'research_tech', techId: t.id })}
                  className="text-xs px-2 py-1 rounded bg-accent-red/20 border border-accent-red/50 text-accent-red hover:bg-accent-red/30 cursor-pointer shrink-0">
                  Research
                </button>
              )}
            </div>
          );
        })}
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
