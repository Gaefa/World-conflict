'use client';

import type { PlayerAction } from '@conflict-game/shared-types';
import { useLocaleStore } from '@/stores/localeStore';
import { StatCard, Bar, ActionBtn, formatNum, type TabProps } from './_shared';

export function MilitaryTab({ country, canAct, onAction, targetCountryCode, playerCountryCode }: TabProps) {
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
