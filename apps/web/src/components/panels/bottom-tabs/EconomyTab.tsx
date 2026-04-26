'use client';

import { useState } from 'react';
import type { DiplomaticRelation, TradeFlow } from '@conflict-game/shared-types';
import type { CountryState, PlayerAction, ResourceType, ResourceBalance } from '@conflict-game/shared-types';
import { useLocaleStore } from '@/stores/localeStore';
import type { Translations } from '@/lib/i18n/types';
import { StatCard, Bar, EffectRow, ActionBtn, getResourceLabel, type TabProps } from './_shared';

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

export function EconomyTab({ country, canAct, onAction, hasSanctions, playerCountryCode, relations }: TabProps) {
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

      {subTab === 'overview' && <EconOverviewSub country={country} playerCountryCode={playerCountryCode} relations={relations} />}
      {subTab === 'resources' && <EconResourcesSub country={country} canAct={canAct} act={act} />}
      {subTab === 'policy' && <EconPolicySub country={country} canAct={canAct} act={act} hasSanctions={hasSanctions} />}
    </div>
  );
}

function EconOverviewSub({
  country,
  playerCountryCode,
  relations,
}: {
  country: CountryState;
  playerCountryCode?: string | null;
  relations?: DiplomaticRelation[];
}) {
  const { t } = useLocaleStore();
  const e = country.economy;
  const rs = country.resourceState ?? {};

  // Active trade agreements for this player
  const tradeAgreements = relations?.filter(
    r => r.type === 'trade_agreement' && r.status === 'active' &&
      playerCountryCode &&
      (r.fromCountry === playerCountryCode || r.toCountry === playerCountryCode)
  ) ?? [];

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
      {tradeAgreements.length > 0 && (
        <div className="col-span-3 mt-3 border-t border-border-default pt-3">
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">🤝 {t.econ_trade_partners}</h4>
          <div className="space-y-1">
            {tradeAgreements.map(rel => {
              const partner = rel.fromCountry === playerCountryCode ? rel.toCountry : rel.fromCountry;
              const flows: TradeFlow[] = (rel as unknown as { tradeFlows?: TradeFlow[] }).tradeFlows ?? [];
              const outgoing = flows.filter(f =>
                (f.direction === 'from_to' && rel.fromCountry === playerCountryCode) ||
                (f.direction === 'to_from' && rel.toCountry === playerCountryCode)
              );
              const incoming = flows.filter(f =>
                (f.direction === 'from_to' && rel.toCountry === playerCountryCode) ||
                (f.direction === 'to_from' && rel.fromCountry === playerCountryCode)
              );
              return (
                <div key={rel.id} className="flex items-start gap-3 bg-bg-card border border-border-default rounded px-2 py-1.5 text-xs">
                  <span className="text-text-secondary font-bold shrink-0 w-8">{partner}</span>
                  <div className="flex-1 min-w-0">
                    {outgoing.length > 0 && (
                      <div className="text-amber-400">
                        → {outgoing.map(f => `${getResourceLabel(t, f.resource)} ×${f.amountPerTick}/mo`).join(', ')}
                      </div>
                    )}
                    {incoming.length > 0 && (
                      <div className="text-accent-green">
                        ← {incoming.map(f => `${getResourceLabel(t, f.resource)} ×${f.amountPerTick}/mo`).join(', ')}
                      </div>
                    )}
                    {flows.length === 0 && <span className="text-text-muted">{t.diplo_general_trade}</span>}
                  </div>
                  {rel.expiresAtTick !== undefined && (
                    <span className="text-text-muted shrink-0">{t.econ_trade_expires} {rel.expiresAtTick}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EconResourcesSub({ country, canAct, act }: { country: CountryState; canAct: boolean; act: (a: PlayerAction) => void }) {
  const { t } = useLocaleStore();
  const rs = country.resourceState ?? {};
  const resourceCategories = getResourceCategories(t);

  // Smart stockpile: pick highest-deficit resource, fallback to 'oil'
  const topDeficitResource: ResourceType = (() => {
    let best: ResourceType = 'oil';
    let bestVal = 0;
    for (const [r, b] of Object.entries(rs)) {
      if (b && b.deficit > bestVal) { bestVal = b.deficit; best = r as ResourceType; }
    }
    return best;
  })();
  const [stockpileRes, setStockpileRes] = useState<ResourceType>(topDeficitResource);
  const allResourceTypes: ResourceType[] = [
    'oil','gas','coal','iron','copper','aluminum','rareEarth','lithium',
    'wheat','rice','fish','freshWater','steel','electronics','semiconductors',
  ];

  return (
    <div className="space-y-3">
      {/* Stockpile action */}
      {canAct && (
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-text-muted">{t.econ_stockpile_for}</span>
            <select
              value={stockpileRes}
              onChange={e => setStockpileRes(e.target.value as ResourceType)}
              className="text-xs bg-bg-card border border-border-default rounded px-1 py-0.5 text-text-primary"
            >
              {allResourceTypes.map(r => (
                <option key={r} value={r}>
                  {getResourceLabel(t, r)}{rs[r]?.deficit ? ` ⚠ -${rs[r]!.deficit.toFixed(1)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <ActionBtn
              label={`${t.econ_build_stockpile_3} (${getResourceLabel(t, stockpileRes)})`}
              cost={t.econ_cost_varies}
              effect={t.econ_reserves_3}
              disabled={!canAct || country.economy.budget < 5}
              onClick={() => act({ type: 'build_stockpile', resource: stockpileRes, months: 3 })}
            />
            <ActionBtn
              label={`${t.econ_build_stockpile_6} (${getResourceLabel(t, stockpileRes)})`}
              cost={t.econ_cost_varies}
              effect={t.econ_reserves_6}
              disabled={!canAct || country.economy.budget < 10}
              onClick={() => act({ type: 'build_stockpile', resource: stockpileRes, months: 6 })}
            />
          </div>
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
  const [manipRes, setManipRes] = useState<ResourceType>('oil');
  const manipResources: ResourceType[] = ['oil', 'gas', 'coal', 'iron', 'rareEarth', 'wheat', 'steel'];

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
        <div className="mb-2 flex items-center gap-1">
          <span className="text-xs text-text-muted">{t.econ_manip_resource}</span>
          <select
            value={manipRes}
            onChange={e => setManipRes(e.target.value as ResourceType)}
            className="text-xs bg-bg-card border border-border-default rounded px-1 py-0.5 text-text-primary"
          >
            {manipResources.map(r => (
              <option key={r} value={r}>{getResourceLabel(t, r)}</option>
            ))}
          </select>
        </div>
        <ActionBtn
          label={t.econ_production_cut}
          cost={t.econ_production_cut_cost}
          effect={t.econ_production_cut_eff}
          disabled={!canAct}
          onClick={() => act({ type: 'manipulate_price', resource: manipRes, direction: 'increase', method: 'production_cut' })}
        />
        <ActionBtn
          label={t.econ_dump_stockpile}
          cost={t.econ_dump_stockpile_cost}
          effect={t.econ_dump_stockpile_eff}
          disabled={!canAct}
          onClick={() => act({ type: 'manipulate_price', resource: manipRes, direction: 'decrease', method: 'dump_stockpile' })}
        />
      </div>
    </div>
  );
}
