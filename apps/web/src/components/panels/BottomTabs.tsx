'use client';

import { useState } from 'react';
import type { CountryState, PlayerAction, ResourceType, ResourceBalance, DiplomaticRelation } from '@conflict-game/shared-types';
import { RelationsPanel } from './RelationsPanel';
import { useLocaleStore } from '@/stores/localeStore';
import type { Translations } from '@/lib/i18n/types';

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

const TAB_KEYS = ['Economy', 'Military', 'Diplomacy', 'Intelligence', 'Research', 'Domestic'] as const;
type Tab = (typeof TAB_KEYS)[number];

function getTabLabel(t: Translations, tab: Tab): string {
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
  /** All diplomatic relations in the game */
  relations?: DiplomaticRelation[];
  /** Current game tick */
  currentTick?: number;
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
  relations,
  currentTick,
}: BottomTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const { t } = useLocaleStore();

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
                {getTabLabel(t, activeTab)}
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
                  <p className="mb-2">{countryName || country.code} — {t.bt_nonplayable_line1}</p>
                  <p>{t.bt_nonplayable_line2}</p>
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
                  relations={relations}
                  currentTick={currentTick}
                />
              )
            ) : (
              <p className="text-text-muted text-sm">
                {t.bt_click_country_hint}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="h-10 bg-bg-secondary border-t border-border-default flex items-center px-4 shrink-0">
        <div className="flex gap-4">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(activeTab === tab ? null : tab)}
              className={`text-xs uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'text-accent-red font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {getTabLabel(t, tab)}
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
  relations?: DiplomaticRelation[];
  currentTick?: number;
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

// ── Resource UI helpers ──

function getResourceCategories(t: Translations): { label: string; icon: string; resources: ResourceType[] }[] {
  return [
    { label: t.resc_energy, icon: '\u26FD', resources: ['oil', 'gas', 'coal', 'refinedOil'] },
    { label: t.resc_industrial, icon: '\u2699', resources: ['iron', 'copper', 'aluminum', 'titanium', 'steel'] },
    { label: t.resc_precious, icon: '\u2B50', resources: ['gold', 'silver', 'palladium', 'platinum'] },
    { label: t.resc_luxury, icon: '\u2666', resources: ['diamonds', 'gemstones', 'luxuryGoods'] },
    { label: t.resc_strategic, icon: '\u26A0', resources: ['rareEarth', 'lithium', 'cobalt'] },
    { label: t.resc_nuclear, icon: '\u2622', resources: ['uranium', 'nuclearFuel'] },
    { label: t.resc_forestry, icon: '\u{1F332}', resources: ['timber', 'rareWood'] },
    { label: t.resc_agriculture, icon: '\u{1F33E}', resources: ['wheat', 'rice', 'fish', 'freshWater', 'fertilizer'] },
    { label: t.resc_advanced, icon: '\u{1F4BB}', resources: ['electronics', 'semiconductors', 'weaponsComponents', 'pharmaceuticals'] },
  ];
}

function getResourceLabel(t: Translations, key: string): string {
  return (t as any)['rlabel_' + key] ?? key;
}

function EconomyTab({ country, canAct, onAction, hasSanctions }: TabProps) {
  const { t } = useLocaleStore();
  const e = country.economy;
  const [subTab, setSubTab] = useState<'overview' | 'resources' | 'policy'>('overview');

  const econSubTabs: { key: 'overview' | 'resources' | 'policy'; label: string }[] = [
    { key: 'overview', label: t.econ_sub_overview },
    { key: 'resources', label: t.econ_sub_resources },
    { key: 'policy', label: t.econ_sub_policy },
  ];

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <StatCard label={t.econ_stat_gdp} value={`$${(e.gdp / 1000).toFixed(1)}T`} sub={`${t.econ_stat_growth_prefix}: ${e.gdpGrowth.toFixed(1)}%`} />
        <StatCard label={t.econ_stat_budget} value={`$${e.budget.toFixed(0)}B`} sub={`${t.econ_stat_tax_rate}: ${(e.taxRate * 100).toFixed(0)}%`} />
        <StatCard label={t.econ_stat_inflation} value={`${e.inflation.toFixed(1)}%`} sub={e.inflation > 5 ? t.econ_inflation_high : t.econ_inflation_stable} />
        <StatCard label={t.econ_stat_debt} value={`${(e.debtToGdp * 100).toFixed(0)}%`} sub={`${t.econ_stat_trade_prefix}: ${e.tradeBalance > 0 ? '+' : ''}${e.tradeBalance.toFixed(0)}B`} />
      </div>

      {/* Resource shock indicator */}
      {e.resourceShockMultiplier > 1.05 && (
        <div className="bg-severity-high/20 border border-severity-high/40 rounded px-3 py-1.5 mb-3 text-xs text-severity-high">
          {t.econ_resource_shock}: x{e.resourceShockMultiplier.toFixed(2)}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-3 border-b border-border-default pb-1">
        {econSubTabs.map(st => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={`px-3 py-1 text-xs font-bold uppercase rounded-t transition-colors ${
              subTab === st.key
                ? 'bg-bg-card text-text-primary border border-border-default border-b-0'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && <EconOverviewSub country={country} />}
      {subTab === 'resources' && <EconResourcesSub country={country} canAct={canAct} act={act} />}
      {subTab === 'policy' && <EconPolicySub country={country} canAct={canAct} act={act} hasSanctions={hasSanctions} />}
    </div>
  );
}

function EconOverviewSub({ country }: { country: CountryState }) {
  const { t } = useLocaleStore();
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
        <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.econ_indicators}</h4>
        <EffectRow label={t.econ_row_gdp_growth} value={`${e.gdpGrowth > 0 ? '+' : ''}${e.gdpGrowth.toFixed(1)}%`} positive={e.gdpGrowth > 0} />
        <EffectRow label={t.econ_row_trade_balance} value={`${e.tradeBalance > 0 ? '+' : ''}$${e.tradeBalance.toFixed(0)}B`} positive={e.tradeBalance > 0} />
        <EffectRow label={t.econ_row_debt_level} value={`${(e.debtToGdp * 100).toFixed(0)}${t.econ_row_debt_of_gdp}`} positive={e.debtToGdp < 0.6} />
        <Bar label={t.econ_bar_sanction_resilience} value={e.sanctionResilience} max={100} color="bg-accent-amber" />
        <Bar label={t.econ_bar_sanction_evasion} value={e.sanctionEvasion} max={100} color="bg-accent-blue" />
      </div>
      <div>
        <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.econ_top_deficits}</h4>
        {deficits.length === 0 ? (
          <p className="text-text-muted text-xs">{t.econ_no_deficits}</p>
        ) : (
          deficits.map(([r, b]) => (
            <EffectRow
              key={r}
              label={getResourceLabel(t, r)}
              value={`-${(b?.deficit ?? 0).toFixed(1)}/mo`}
              positive={false}
            />
          ))
        )}
      </div>
      <div>
        <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.econ_top_surpluses}</h4>
        {surpluses.length === 0 ? (
          <p className="text-text-muted text-xs">{t.econ_no_surpluses}</p>
        ) : (
          surpluses.map(([r, b]) => {
            const surplus = (b?.production ?? 0) - (b?.consumption ?? 0) - (b?.exported ?? 0);
            return (
              <EffectRow
                key={r}
                label={getResourceLabel(t, r)}
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
  const { t } = useLocaleStore();
  const rs = country.resourceState ?? {};
  const resourceCategories = getResourceCategories(t);

  return (
    <div className="space-y-3">
      {/* Stockpile action */}
      {canAct && (
        <div className="flex gap-2 mb-2">
          <ActionBtn
            label={t.econ_build_stockpile_3}
            cost={t.econ_cost_varies}
            effect={t.econ_reserves_3}
            disabled={!canAct || country.economy.budget < 5}
            onClick={() => act({ type: 'build_stockpile', resource: 'oil', months: 3 })}
          />
          <ActionBtn
            label={t.econ_build_stockpile_6}
            cost={t.econ_cost_varies}
            effect={t.econ_reserves_6}
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
              <th className="text-left py-1 pr-2">{t.econ_tbl_resource}</th>
              <th className="text-right px-1">{t.econ_tbl_prod}</th>
              <th className="text-right px-1">{t.econ_tbl_cons}</th>
              <th className="text-right px-1">{t.econ_tbl_import}</th>
              <th className="text-right px-1">{t.econ_tbl_export}</th>
              <th className="text-right px-1">{t.econ_tbl_deficit}</th>
              <th className="text-right pl-1">{t.econ_tbl_stock}</th>
            </tr>
          </thead>
          <tbody>
            {resourceCategories.map(cat => {
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
                      <td className="py-0.5 pr-2 text-text-primary">{getResourceLabel(t, r)}</td>
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
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-1">{t.econ_processing_caps}</h4>
          <div className="flex flex-wrap gap-1">
            {country.processingCapabilities.map(p => (
              <span key={p} className="bg-bg-card border border-border-default rounded px-2 py-0.5 text-xs text-accent-blue">
                {getResourceLabel(t, p)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EconPolicySub({ country, canAct, act, hasSanctions }: { country: CountryState; canAct: boolean; act: (a: PlayerAction) => void; hasSanctions?: boolean }) {
  const { t } = useLocaleStore();
  const e = country.economy;

  return (
    <div className={`grid ${hasSanctions ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
      <div>
        <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.econ_policy_header}</h4>
        <ActionBtn
          label={t.econ_policy_invest}
          cost="$10B"
          effect={t.econ_policy_invest_eff}
          disabled={!canAct || e.budget < 10}
          onClick={() => act({ type: 'allocate_budget', category: 'economy', amount: 10 })}
        />
        <ActionBtn
          label={t.econ_policy_raise}
          cost={t.econ_policy_raise_cost}
          effect={t.econ_policy_raise_eff}
          disabled={!canAct || e.taxRate >= 0.95}
          onClick={() => act({ type: 'set_tax_rate', rate: Math.min(1, e.taxRate + 0.05) })}
        />
        <ActionBtn
          label={t.econ_policy_lower}
          cost={t.econ_policy_lower_cost}
          effect={t.econ_policy_lower_eff}
          disabled={!canAct || e.taxRate <= 0.05}
          onClick={() => act({ type: 'set_tax_rate', rate: Math.max(0, e.taxRate - 0.05) })}
        />
      </div>
      {hasSanctions && (
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.econ_sanction_evasion_header}</h4>
          <ActionBtn
            label={t.econ_shadow_fleet}
            cost="$5B"
            effect={t.econ_shadow_fleet_eff}
            disabled={!canAct || e.budget < 5}
            onClick={() => act({ type: 'sanction_evasion', method: 'shadow_fleet' })}
          />
          <ActionBtn
            label={t.econ_crypto}
            cost={t.econ_crypto_cost}
            effect={t.econ_crypto_eff}
            disabled={!canAct || e.budget < 3 || country.techLevel < 5}
            onClick={() => act({ type: 'sanction_evasion', method: 'crypto_bypass' })}
          />
          <ActionBtn
            label={t.econ_parallel}
            cost="$8B"
            effect={t.econ_parallel_eff}
            disabled={!canAct || e.budget < 8}
            onClick={() => act({ type: 'sanction_evasion', method: 'parallel_import' })}
          />
          <ActionBtn
            label={t.econ_substitution}
            cost="$20B"
            effect={t.econ_substitution_eff}
            disabled={!canAct || e.budget < 20}
            onClick={() => act({ type: 'sanction_evasion', method: 'import_substitution' })}
          />
        </div>
      )}
      <div>
        <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.econ_price_manip_header}</h4>
        <ActionBtn
          label={t.econ_production_cut}
          cost={t.econ_production_cut_cost}
          effect={t.econ_production_cut_eff}
          disabled={!canAct}
          onClick={() => act({ type: 'manipulate_price', resource: 'oil', direction: 'increase', method: 'production_cut' })}
        />
        <ActionBtn
          label={t.econ_dump_stockpile}
          cost={t.econ_dump_stockpile_cost}
          effect={t.econ_dump_stockpile_eff}
          disabled={!canAct}
          onClick={() => act({ type: 'manipulate_price', resource: 'oil', direction: 'decrease', method: 'dump_stockpile' })}
        />
      </div>
    </div>
  );
}

function MilitaryTab({ country, canAct, onAction, targetCountryCode, playerCountryCode }: TabProps) {
  const { t } = useLocaleStore();
  const m = country.military;
  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard label={t.mil_stat_army} value={formatNum(m.army)} sub={t.mil_stat_army_sub} />
        <StatCard label={t.mil_stat_navy} value={formatNum(m.navy)} sub={t.mil_stat_navy_sub} />
        <StatCard label={t.mil_stat_airforce} value={formatNum(m.airForce)} sub={t.mil_stat_airforce_sub} />
        <StatCard label={t.mil_stat_nuclear} value={m.nuclearWeapons.toString()} sub={t.mil_stat_nuclear_sub} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.mil_section_capabilities}</h4>
          <Bar label={t.mil_bar_defense_budget} value={m.defenseBudget} max={800} color="bg-accent-amber" />
          <Bar label={t.mil_bar_tech_level} value={m.techLevel} max={10} color="bg-accent-blue" />
          <Bar label={t.mil_bar_total_power} value={country.indexOfPower} max={100} color="bg-accent-red" />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.mil_section_buildup}</h4>
          <ActionBtn
            label={t.mil_recruit_infantry}
            cost="$5B"
            effect={t.mil_recruit_infantry_eff}
            disabled={!canAct || country.economy.budget < 5}
            onClick={() => act({ type: 'allocate_budget', category: 'military', amount: 5 })}
          />
          <ActionBtn
            label={t.mil_rnd}
            cost="$10B"
            effect={t.mil_rnd_eff}
            disabled={!canAct || country.economy.budget < 10}
            onClick={() => act({ type: 'research_tech', category: 'military' })}
          />
          <ActionBtn
            label={t.mil_arms_deal}
            cost={t.mil_arms_deal_cost}
            effect={t.mil_arms_deal_eff}
            disabled={!canAct || !hasTarget || m.techLevel < 3}
            onClick={() => act({ type: 'arms_deal', targetCountry: targetCountryCode!, amount: 5 })}
          />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
            {t.mil_section_ops} {hasTarget ? `→ ${targetCountryCode}` : ''}
          </h4>
          <ActionBtn
            label={t.mil_surgical}
            cost={t.mil_surgical_cost}
            effect={t.mil_surgical_eff}
            disabled={!canAct || !hasTarget || m.airForce < 10 || country.economy.budget < 2}
            onClick={() => act({ type: 'airstrike', targetCountry: targetCountryCode!, intensity: 'surgical' })}
          />
          <ActionBtn
            label={t.mil_carpet}
            cost={t.mil_carpet_cost}
            effect={t.mil_carpet_eff}
            disabled={!canAct || !hasTarget || m.airForce < 50 || country.economy.budget < 20}
            onClick={() => act({ type: 'airstrike', targetCountry: targetCountryCode!, intensity: 'carpet' })}
          />
          <ActionBtn
            label={t.mil_ground_invasion}
            cost={t.mil_ground_cost}
            effect={t.mil_ground_eff}
            disabled={!canAct || !hasTarget || m.army < 1000}
            onClick={() => act({ type: 'invasion', targetCountry: targetCountryCode!, committedForces: 0.25 })}
          />
          <ActionBtn
            label={t.mil_naval_blockade}
            cost={t.mil_naval_cost}
            effect={t.mil_naval_eff}
            disabled={!canAct || !hasTarget || m.navy < 20 || country.economy.budget < 5}
            onClick={() => act({ type: 'naval_blockade', targetCountry: targetCountryCode! })}
          />
        </div>
      </div>
    </div>
  );
}

function DiplomacyTab({ country, canAct, onAction, targetCountryCode, playerCountryCode, relations, currentTick }: TabProps) {
  const { t } = useLocaleStore();
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

  // Tradeable resources with localized labels
  const tradeableResources: { resource: ResourceType; label: string }[] = [
    { resource: 'oil', label: getResourceLabel(t, 'oil') }, { resource: 'gas', label: getResourceLabel(t, 'gas') },
    { resource: 'coal', label: getResourceLabel(t, 'coal') }, { resource: 'iron', label: getResourceLabel(t, 'iron') },
    { resource: 'copper', label: getResourceLabel(t, 'copper') }, { resource: 'aluminum', label: getResourceLabel(t, 'aluminum') },
    { resource: 'titanium', label: getResourceLabel(t, 'titanium') }, { resource: 'gold', label: getResourceLabel(t, 'gold') },
    { resource: 'rareEarth', label: getResourceLabel(t, 'rareEarth') }, { resource: 'lithium', label: getResourceLabel(t, 'lithium') },
    { resource: 'uranium', label: getResourceLabel(t, 'uranium') }, { resource: 'wheat', label: getResourceLabel(t, 'wheat') },
    { resource: 'rice', label: getResourceLabel(t, 'rice') }, { resource: 'timber', label: getResourceLabel(t, 'timber') },
    { resource: 'steel', label: getResourceLabel(t, 'steel') }, { resource: 'electronics', label: getResourceLabel(t, 'electronics') },
    { resource: 'semiconductors', label: getResourceLabel(t, 'semiconductors') }, { resource: 'refinedOil', label: getResourceLabel(t, 'refinedOil') },
    { resource: 'weaponsComponents', label: getResourceLabel(t, 'weaponsComponents') }, { resource: 'pharmaceuticals', label: getResourceLabel(t, 'pharmaceuticals') },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label={t.diplo_stat_influence} value={country.diplomaticInfluence.toFixed(0)} sub={t.diplo_stat_influence_sub} />
        <StatCard label={t.diplo_stat_power} value={country.indexOfPower.toFixed(1)} sub={t.diplo_stat_power_sub} />
        <StatCard label={t.diplo_stat_relations} value="—" sub={t.diplo_stat_relations_sub} />
      </div>

      {!showTrade ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.diplo_status}</h4>
            <Bar label={t.diplo_bar_influence} value={country.diplomaticInfluence} max={100} color="bg-accent-blue" />
            <EffectRow label={t.diplo_target_label} value={hasTarget ? targetCountryCode! : t.diplo_click_country} />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
              {t.diplo_actions_label} {hasTarget ? `\u2192 ${targetCountryCode}` : ''}
            </h4>
            <ActionBtn
              label={t.diplo_propose_alliance}
              cost={t.diplo_alliance_cost}
              effect={t.diplo_alliance_eff}
              disabled={!canAct || !hasTarget || country.diplomaticInfluence < 5}
              onClick={() => act({ type: 'propose_alliance', targetCountry: targetCountryCode! })}
            />
            <ActionBtn
              label={t.diplo_declare_war}
              cost={t.diplo_war_cost}
              effect={t.diplo_war_eff}
              disabled={!canAct || !hasTarget}
              onClick={() => act({ type: 'declare_war', targetCountry: targetCountryCode! })}
            />
            <ActionBtn
              label={t.diplo_sanctions}
              cost={t.diplo_sanction_cost}
              effect={t.diplo_sanction_eff}
              disabled={!canAct || !hasTarget || country.diplomaticInfluence < 3}
              onClick={() => act({ type: 'propose_sanction', targetCountry: targetCountryCode! })}
            />
            <ActionBtn
              label={t.diplo_trade}
              cost={t.diplo_trade_cost}
              effect={t.diplo_trade_eff}
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
              {t.diplo_trade_with} {targetCountryCode}
            </h4>
            <button onClick={() => setShowTrade(false)} className="text-text-muted hover:text-text-primary text-xs">
              {t.diplo_cancel}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* YOU OFFER */}
            <div>
              <h5 className="text-xs font-bold text-accent-green mb-2">{t.diplo_you_offer}</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {tradeableResources.map(({ resource, label }) => {
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
              <h5 className="text-xs font-bold text-severity-high mb-2">{t.diplo_you_request}</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {tradeableResources.map(({ resource, label }) => {
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
            {t.diplo_send_trade}
          </button>
        </div>
      )}

      {/* Relations overview */}
      {relations && relations.length > 0 && (
        <div className="mt-4 border-t border-border-default pt-3">
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.diplo_active_relations_header}</h4>
          <RelationsPanel
            relations={relations}
            playerCountryCode={playerCountryCode ?? null}
            currentTick={currentTick ?? 0}
          />
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

function getSpyOpLabels(t: Translations): Record<SpyOpKey, string> {
  return {
    humint: t.intel_op_humint,
    sigint: t.intel_op_sigint,
    satellite: t.intel_op_satellite,
    cyber_espionage: t.intel_op_cyber,
    diplomatic_probe: t.intel_op_probe,
  };
}

function getRevealsLabel(t: Translations, reveals: string): string {
  const map: Record<string, string> = {
    military: t.intel_reveals_military,
    economy: t.intel_reveals_economy,
    resources: t.intel_reveals_resources,
    stability: t.intel_reveals_stability,
    diplomacy: t.intel_reveals_diplomacy,
  };
  return map[reveals] ?? reveals;
}

function IntelligenceTab({ country, canAct, onAction, targetCountryCode, playerCountryCode }: TabProps) {
  const { t } = useLocaleStore();
  const [intelSub, setIntelSub] = useState<'overview' | 'dossiers' | 'ops' | 'covert'>('overview');
  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;
  const intel = country.intel;

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const subTabs = [
    { key: 'overview' as const, label: t.intel_sub_overview },
    { key: 'dossiers' as const, label: t.intel_sub_dossiers },
    { key: 'ops' as const, label: t.intel_sub_ops },
    { key: 'covert' as const, label: t.intel_sub_covert },
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
  const { t } = useLocaleStore();
  const counterIntel = intel?.counterIntel ?? 0;
  const intelBudget = intel?.intelBudget ?? 0;
  const activeOpsCount = intel ? Object.values(intel.dossiers).reduce((n, d) => n + d.activeOps.length, 0) : 0;
  const disinfoCount = intel?.disinfo.length ?? 0;
  const dossierCount = intel ? Object.keys(intel.dossiers).length : 0;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard label={t.intel_stat_counter} value={counterIntel.toFixed(0)} sub={counterIntel > 60 ? t.intel_counter_strong : counterIntel > 30 ? t.intel_counter_moderate : t.intel_counter_weak} />
        <StatCard label={t.intel_stat_budget} value={`$${intelBudget.toFixed(0)}B/mo`} sub={t.intel_stat_budget_sub} />
        <StatCard label={t.intel_stat_active_ops} value={String(activeOpsCount)} sub={`${dossierCount} ${t.intel_targets_suffix}`} />
        <StatCard label={t.intel_stat_disinfo} value={String(disinfoCount)} sub={t.intel_stat_disinfo_sub} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_section_defense}</h4>
          <Bar label={t.intel_bar_counter} value={counterIntel} max={100} color="bg-accent-blue" />
          <ActionBtn label={t.intel_boost_5} cost="$5B" effect={t.intel_boost_5_eff}
            disabled={!canAct || country.economy.budget < 5}
            onClick={() => act({ type: 'boost_counter_intel', amount: 5 })} />
          <ActionBtn label={t.intel_boost_15} cost="$15B" effect={t.intel_boost_15_eff}
            disabled={!canAct || country.economy.budget < 15}
            onClick={() => act({ type: 'boost_counter_intel', amount: 15 })} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_budget_header}</h4>
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
          <p className="text-text-muted text-xs">{t.intel_budget_note}</p>
        </div>
      </div>
    </div>
  );
}

function IntelDossiersSub({ country, intel }: { country: CountryState; intel: CountryState['intel'] }) {
  const { t } = useLocaleStore();
  const dossiers = intel?.dossiers ?? {};
  const entries = Object.entries(dossiers);
  const spyOpLabels = getSpyOpLabels(t);

  const revealsCategoryLabels: Record<string, string> = {
    economy: t.intel_reveals_economy,
    military: t.intel_reveals_military,
    resources: t.intel_reveals_resources,
    stability: t.intel_reveals_stability,
    diplomacy: t.intel_reveals_diplomacy,
  };

  if (entries.length === 0) {
    return <p className="text-text-muted text-sm">{t.intel_no_dossiers}</p>;
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
                {dossier.level} ({dossier.intelPoints} {t.intel_dossier_pts_suffix})
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
                  {revealed[cat] ? '\u2713' : '?'} {revealsCategoryLabels[cat] ?? cat}
                </span>
              ))}
            </div>
            {dossier.activeOps.length > 0 && (
              <div className="mt-1.5 text-xs text-text-muted">
                {t.intel_active_ops_label} {dossier.activeOps.map(op => spyOpLabels[op.type as SpyOpKey]).join(', ')}
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
  const { t } = useLocaleStore();

  const spyOps: { key: SpyOpKey; label: string }[] = [
    { key: 'humint', label: t.intel_op_humint },
    { key: 'sigint', label: t.intel_op_sigint },
    { key: 'satellite', label: t.intel_op_satellite },
    { key: 'cyber_espionage', label: t.intel_op_cyber },
    { key: 'diplomatic_probe', label: t.intel_op_probe },
  ];

  const categoryLabels: Record<string, string> = {
    economy: t.intel_category_economy,
    military: t.intel_category_military,
    stability: t.intel_category_stability,
  };

  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
        {t.intel_launch_spy_op} {hasTarget ? <span className="text-accent-red">→ {targetCountryCode}</span> : <span className="text-text-muted">{t.intel_select_target_hint}</span>}
      </h4>
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {spyOps.map(({ key, label }) => {
          const cfg = SPY_OP_CONFIG_UI[key];
          const techOk = (country.techLevel ?? 1) >= cfg.techRequired;
          const budgetOk = country.economy.budget >= cfg.cost;
          const effectStr = t.intel_op_effect_fmt
            .replace('{duration}', String(cfg.baseDuration))
            .replace('{reveals}', getRevealsLabel(t, cfg.reveals))
            .replace('{risk}', (cfg.detectionRisk * 100).toFixed(0));
          return (
            <ActionBtn key={key} label={label}
              cost={`$${cfg.cost}B${cfg.techRequired > 1 ? `, Tech ${cfg.techRequired}+` : ''}`}
              effect={effectStr}
              disabled={!canAct || !hasTarget || !techOk || !budgetOk}
              onClick={() => act({ type: 'launch_spy_op', targetCountry: targetCountryCode!, opType: key as any })} />
          );
        })}
      </div>

      <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_disinfo_header}</h4>
      <p className="text-text-muted text-xs mb-2">{t.intel_disinfo_desc}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {(['economy', 'military', 'stability'] as const).map(cat => {
          const existing = intel?.disinfo.find(d => d.category === cat);
          return (
            <div key={cat} className="bg-bg-card border border-border-default rounded p-2">
              <div className="text-xs font-bold text-text-secondary uppercase mb-1">{categoryLabels[cat] ?? cat}</div>
              {existing ? (
                <div className="text-xs text-accent-amber">
                  {t.intel_disinfo_active_fmt.replace('{mult}', existing.multiplier.toFixed(1)).replace('{dur}', String(existing.duration))}
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
  const { t } = useLocaleStore();

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
            {t.intel_covert_ops_label} {hasTarget ? `→ ${targetCountryCode}` : ''}
          </h4>
          <ActionBtn label={t.intel_sabotage_energy} cost="$5B" effect={t.intel_sabotage_energy_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 5}
            onClick={() => act({ type: 'sabotage', targetCountry: targetCountryCode!, target: 'energy' })} />
          <ActionBtn label={t.intel_sabotage_military} cost="$5B" effect={t.intel_sabotage_military_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 5}
            onClick={() => act({ type: 'sabotage', targetCountry: targetCountryCode!, target: 'military' })} />
          <ActionBtn label={t.intel_cyber_attack} cost={t.intel_cyber_attack_cost} effect={t.intel_cyber_attack_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 3 || country.techLevel < 3}
            onClick={() => act({ type: 'cyber_attack', targetCountry: targetCountryCode!, target: 'financial' })} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_destabilization}</h4>
          <ActionBtn label={t.intel_incite} cost={t.intel_incite_cost} effect={t.intel_incite_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 8 || country.diplomaticInfluence < 3}
            onClick={() => act({ type: 'incite_rebellion', targetCountry: targetCountryCode! })} />
          <ActionBtn label={t.intel_propaganda} cost={t.intel_propaganda_cost} effect={t.intel_propaganda_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 3}
            onClick={() => act({ type: 'propaganda', targetCountry: targetCountryCode!, narrative: 'anti_government' })} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_black_ops}</h4>
          <ActionBtn label={t.intel_proxy_war} cost={t.intel_proxy_war_cost} effect={t.intel_proxy_war_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 10 || country.diplomaticInfluence < 5}
            onClick={() => act({ type: 'proxy_war', targetCountry: targetCountryCode!, funding: 10 })} />
          <ActionBtn label={t.intel_stage_coup} cost={t.intel_stage_coup_cost} effect={t.intel_stage_coup_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 15 || country.diplomaticInfluence < 10}
            onClick={() => act({ type: 'coup_attempt', targetCountry: targetCountryCode! })} />
          <ActionBtn label={t.intel_false_flag} cost={t.intel_false_flag_cost} effect={t.intel_false_flag_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 12 || country.diplomaticInfluence < 8}
            onClick={() => act({ type: 'false_flag', targetCountry: targetCountryCode!, framedCountry: 'RU', operation: 'terrorist_attack' })} />
        </div>
      </div>
    </div>
  );
}

// ── Tech Tree UI constants (inlined for Turbopack compat) ──

type TechBranchKey = 'military' | 'economic' | 'cyber' | 'space' | 'biotech' | 'infrastructure';

function getBranchMeta(t: Translations): { key: TechBranchKey; label: string; icon: string }[] {
  return [
    { key: 'military', label: t.research_branch_military, icon: '\u2694\uFE0F' },
    { key: 'economic', label: t.research_branch_economic, icon: '\u{1F4B0}' },
    { key: 'cyber', label: t.research_branch_cyber, icon: '\u{1F4BB}' },
    { key: 'space', label: t.research_branch_space, icon: '\u{1F680}' },
    { key: 'biotech', label: t.research_branch_biotech, icon: '\u{1F9EC}' },
    { key: 'infrastructure', label: t.research_branch_infra, icon: '\u{1F3D7}\uFE0F' },
  ];
}

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
  const { t, tech: techTranslations } = useLocaleStore();
  const [selectedBranch, setSelectedBranch] = useState<TechBranchKey>('military');
  const countryTech = country.tech;
  const researched = countryTech?.researchedTechs ?? [];
  const activeResearch = countryTech?.activeResearch;
  const branchMeta = getBranchMeta(t);

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const branchTechs = TECH_TREE_UI.filter(td => td.branch === selectedBranch).sort((a, b) => a.tier - b.tier);
  const totalResearched = researched.length;

  const getTechStatus = (td: TechDefUI): 'completed' | 'researching' | 'available' | 'locked' => {
    if (researched.includes(td.id)) return 'completed';
    if (activeResearch?.techId === td.id) return 'researching';
    if (td.prerequisites.every(p => researched.includes(p))) return 'available';
    return 'locked';
  };

  const getTechName = (td: TechDefUI): string => {
    return techTranslations[td.id]?.name ?? td.name;
  };

  const getTechEffects = (td: TechDefUI): string[] => {
    return techTranslations[td.id]?.effects ?? td.effectDesc;
  };

  return (
    <div>
      {/* Active research banner */}
      {activeResearch && (
        <div className="bg-accent-amber/10 border border-accent-amber/30 rounded p-2 mb-3 flex items-center justify-between">
          <div>
            <span className="text-accent-amber text-xs font-bold uppercase">{t.research_active_prefix} </span>
            <span className="text-text-primary text-sm font-bold">
              {(() => { const td = TECH_TREE_UI.find(td => td.id === activeResearch.techId); return td ? getTechName(td) : activeResearch.techId; })()}
            </span>
            <span className="text-text-muted text-xs ml-2">
              {t.research_months_remaining_fmt.replace('{rem}', String(activeResearch.ticksRemaining)).replace('{total}', String(activeResearch.totalTicks))}
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
              {t.research_cancel_btn}
            </button>
          </div>
        </div>
      )}

      {/* Branch selector */}
      <div className="flex gap-1 mb-3">
        {branchMeta.map(b => {
          const branchTechIds = TECH_TREE_UI.filter(td => td.branch === b.key);
          const done = branchTechIds.filter(td => researched.includes(td.id)).length;
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
        <span>{t.research_total_count_fmt.replace('{done}', String(totalResearched)).replace('{total}', String(TECH_TREE_UI.length))}</span>
        <span>{t.research_tech_level_fmt.replace('{lvl}', country.techLevel.toFixed(0))}</span>
      </div>

      {/* Tech list for selected branch */}
      <div className="space-y-1.5">
        {branchTechs.map(td => {
          const status = getTechStatus(td);
          const canStart = status === 'available' && !activeResearch && canAct && country.economy.budget >= td.cost;
          const missingPrereqs = td.prerequisites.filter(p => !researched.includes(p));

          return (
            <div key={td.id} className={`flex items-center gap-2 border rounded p-2 transition-colors ${
              status === 'completed' ? 'border-accent-green/40 bg-accent-green/5' :
              status === 'researching' ? 'border-accent-amber/40 bg-accent-amber/5 animate-pulse' :
              status === 'available' ? 'border-border-default bg-bg-card' :
              'border-border-default/50 bg-bg-card/50 opacity-60'
            }`}>
              <span className="text-lg">{td.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${status === 'completed' ? 'text-accent-green' : status === 'researching' ? 'text-accent-amber' : 'text-text-primary'}`}>
                    {getTechName(td)}
                  </span>
                  {status === 'completed' && <span className="text-accent-green text-xs">{'\u2713'}</span>}
                  {status === 'researching' && <span className="text-accent-amber text-xs">...</span>}
                  {status === 'locked' && missingPrereqs.length > 0 && (
                    <span className="text-text-muted text-xs">
                      {t.research_needs_prefix} {missingPrereqs.map(p => { const prereq = TECH_TREE_UI.find(x => x.id === p); return prereq ? getTechName(prereq) : p; }).join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted truncate">
                  {getTechEffects(td).join(' \u2022 ')}
                </div>
              </div>
              <div className="text-right shrink-0">
                {status === 'completed' ? (
                  <span className="text-accent-green text-xs font-bold">{t.research_done}</span>
                ) : status === 'researching' ? (
                  <span className="text-accent-amber text-xs">{activeResearch?.ticksRemaining}mo</span>
                ) : (
                  <div className="text-right">
                    <div className="text-xs text-accent-amber">${td.cost}B</div>
                    <div className="text-xs text-text-muted">{td.researchTicks}mo</div>
                  </div>
                )}
              </div>
              {canStart && (
                <button onClick={() => act({ type: 'research_tech', techId: td.id })}
                  className="text-xs px-2 py-1 rounded bg-accent-red/20 border border-accent-red/50 text-accent-red hover:bg-accent-red/30 cursor-pointer shrink-0">
                  {t.research_start_btn}
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
  const { t } = useLocaleStore();
  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const revRisk = country.stability < 40 ? 100 - country.stability : 0;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label={t.dom_stat_stability} value={country.stability.toFixed(0)} sub={country.stability < 30 ? t.dom_stat_stability_critical : country.stability < 50 ? t.dom_stat_stability_unstable : t.dom_stat_stability_stable} />
        <StatCard label={t.dom_stat_approval} value={`${country.approval.toFixed(0)}%`} sub={t.dom_stat_approval_sub} />
        <StatCard label={t.dom_stat_tech_level} value={country.techLevel.toFixed(1)} sub={t.dom_stat_tech_level_sub} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.dom_indicators}</h4>
          <Bar label={t.dom_bar_stability} value={country.stability} max={100} color="bg-accent-green" />
          <Bar label={t.dom_bar_approval} value={country.approval} max={100} color="bg-accent-blue" />
          <Bar label={t.dom_bar_revolution} value={revRisk} max={100} color="bg-severity-high" />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.dom_policies}</h4>
          <ActionBtn
            label={t.dom_social}
            cost="$5B"
            effect={t.dom_social_eff}
            disabled={!canAct || country.economy.budget < 5}
            onClick={() => act({ type: 'allocate_budget', category: 'social', amount: 5 })}
          />
          <ActionBtn
            label={t.dom_research_prog}
            cost="$10B"
            effect={t.dom_research_prog_eff}
            disabled={!canAct || country.economy.budget < 10}
            onClick={() => act({ type: 'research_tech', category: 'economy' })}
          />
          <ActionBtn
            label={t.dom_emergency}
            cost="$15B"
            effect={t.dom_emergency_eff}
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
