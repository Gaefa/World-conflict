'use client';

import { useState, useEffect } from 'react';
import type { PlayerAction, ResourceType } from '@conflict-game/shared-types';
import { WarMap } from '../../military/WarMap';
import { useLocaleStore } from '@/stores/localeStore';
import { StatCard, Bar, ActionBtn, formatNum, type TabProps } from './_shared';
import { scaledCost, costLabel } from '@/lib/actionCosts';

export function MilitaryTab({
  country,
  canAct,
  onAction,
  targetCountryCode,
  playerCountryCode,
  relations,
  armies = [],
  allCountries = {},
  warCountries,
}: TabProps) {
  const { t } = useLocaleStore();
  const m = country.military;
  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;
  const isAtWar = (warCountries?.size ?? 0) > 0;
  const [subTab, setSubTab] = useState<'overview' | 'map' | 'ops'>(isAtWar ? 'map' : 'overview');

  // Switch to map when war starts (e.g., mid-session)
  useEffect(() => {
    if (isAtWar) setSubTab('map');
  }, [isAtWar]);

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  // Smart stockpile: pick resource with highest deficit
  const topDeficitResource: ResourceType = (() => {
    const rs = country.resourceState ?? {};
    let best: ResourceType = 'oil';
    let bestVal = 0;
    for (const [r, b] of Object.entries(rs)) {
      if (b && b.deficit > bestVal) {
        bestVal = b.deficit;
        best = r as ResourceType;
      }
    }
    return best;
  })();

  const gdp = country.economy.gdp;
  // Costs scaled to country GDP (same formula as server-side scaledCost)
  const c = {
    recruit:   scaledCost(5,  gdp),
    rnd:       scaledCost(10, gdp),
    surgical:  scaledCost(2,  gdp),
    carpet:    scaledCost(20, gdp),
    naval:     scaledCost(5,  gdp),
    drone:     scaledCost(3,  gdp),
  };

  const milSubTabs = [
    { key: 'overview' as const, label: t.mil_sub_overview },
    { key: 'map' as const, label: t.mil_sub_warmap },
    { key: 'ops' as const, label: t.mil_sub_ops },
  ];

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <StatCard label={t.mil_stat_army} value={formatNum(m.army)} sub={t.mil_stat_army_sub} />
        <StatCard label={t.mil_stat_navy} value={formatNum(m.navy)} sub={t.mil_stat_navy_sub} />
        <StatCard label={t.mil_stat_airforce} value={formatNum(m.airForce)} sub={t.mil_stat_airforce_sub} />
        <StatCard label={t.mil_stat_nuclear} value={m.nuclearWeapons.toString()} sub={t.mil_stat_nuclear_sub} />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-3 border-b border-border-default pb-1">
        {milSubTabs.map((st) => (
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

      {/* ── Overview ── */}
      {subTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
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
              cost={costLabel(5, gdp)}
              effect={t.mil_recruit_infantry_eff}
              disabled={!canAct || country.economy.budget < c.recruit}
              onClick={() => act({ type: 'allocate_budget', category: 'military', amount: c.recruit })}
            />
            <ActionBtn
              label={t.mil_rnd}
              cost={costLabel(10, gdp)}
              effect={t.mil_rnd_eff}
              disabled={!canAct || country.economy.budget < c.rnd}
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
        </div>
      )}

      {/* ── War Map ── */}
      {subTab === 'map' && (
        <WarMap
          armies={armies}
          relations={relations ?? []}
          allCountries={allCountries}
          playerCountryCode={playerCountryCode ?? null}
          onAction={canAct ? onAction : undefined}
        />
      )}

      {/* ── Ops ── */}
      {subTab === 'ops' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
              {t.mil_section_ops} {hasTarget ? `→ ${targetCountryCode}` : '(select target on globe)'}
            </h4>
            <ActionBtn
              label={t.mil_surgical}
              cost={costLabel(2, gdp)}
              effect={t.mil_surgical_eff}
              disabled={!canAct || !hasTarget || m.airForce < 10 || country.economy.budget < c.surgical}
              onClick={() => act({ type: 'airstrike', targetCountry: targetCountryCode!, intensity: 'surgical' })}
            />
            <ActionBtn
              label={t.mil_carpet}
              cost={costLabel(20, gdp)}
              effect={t.mil_carpet_eff}
              disabled={!canAct || !hasTarget || m.airForce < 50 || country.economy.budget < c.carpet}
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
              cost={costLabel(5, gdp)}
              effect={t.mil_naval_eff}
              disabled={!canAct || !hasTarget || m.navy < 20 || country.economy.budget < c.naval}
              onClick={() => act({ type: 'naval_blockade', targetCountry: targetCountryCode! })}
            />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.mil_section_advanced_ops}</h4>
            <ActionBtn
              label={t.mil_drone_raid}
              cost={costLabel(3, gdp)}
              effect={t.mil_drone_raid_eff}
              disabled={!canAct || !hasTarget || !(country.tech?.researchedTechs ?? []).includes('mil_3') || country.economy.budget < c.drone}
              onClick={() => act({ type: 'drone_raid', targetCountry: targetCountryCode!, target: 'military' })}
            />
            <ActionBtn
              label={t.mil_nuclear_tactical}
              cost={t.mil_nuclear_tactical_cost}
              effect={t.mil_nuclear_tactical_eff}
              disabled={!canAct || !hasTarget || !(country.tech?.researchedTechs ?? []).includes('mil_9') || m.nuclearWeapons < 1}
              onClick={() => act({ type: 'nuclear_strike', targetCountry: targetCountryCode!, warhead: 'tactical' })}
            />
            <ActionBtn
              label={t.mil_nuclear_strategic}
              cost={t.mil_nuclear_strategic_cost}
              effect={t.mil_nuclear_strategic_eff}
              disabled={!canAct || !hasTarget || !(country.tech?.researchedTechs ?? []).includes('mil_10') || m.nuclearWeapons < 3}
              onClick={() => act({ type: 'nuclear_strike', targetCountry: targetCountryCode!, warhead: 'strategic' })}
            />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.mil_section_logistics}</h4>
            <ActionBtn
              label={t.econ_build_stockpile_3}
              cost={t.econ_cost_varies}
              effect={t.econ_reserves_3}
              disabled={!canAct || country.economy.budget < 5}
              onClick={() => act({ type: 'build_stockpile', resource: topDeficitResource, months: 3 })}
            />
            <ActionBtn
              label={t.econ_build_stockpile_6}
              cost={t.econ_cost_varies}
              effect={t.econ_reserves_6}
              disabled={!canAct || country.economy.budget < 10}
              onClick={() => act({ type: 'build_stockpile', resource: topDeficitResource, months: 6 })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
