'use client';

import type { PlayerAction } from '@conflict-game/shared-types';
import { useLocaleStore } from '@/stores/localeStore';
import { StatCard, Bar, ActionBtn, type TabProps } from './_shared';

export function DomesticTab({ country, canAct, onAction }: TabProps) {
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
