'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useLocaleStore } from '@/stores/localeStore';
import type { ActionResult } from '@conflict-game/shared-types';
import type { Translations } from '@/lib/i18n/types';

function localizeActionMessage(t: Translations, ar: ActionResult): string {
  const a = ar.action as any;
  const tc: string = a.targetCountry ?? '';

  switch (a.type) {
    case 'airstrike': {
      const intMap: Record<string, string> = {
        surgical: t.res_int_surgical,
        conventional: t.res_int_conventional,
        carpet: t.res_int_carpet,
      };
      return t.res_airstrike
        .replace('{intensity}', intMap[a.intensity] ?? a.intensity)
        .replace('{country}', tc);
    }
    case 'invasion':
      return (ar.success ? t.res_invasion_ok : t.res_invasion_fail).replace('{country}', tc);
    case 'naval_blockade':
      return t.res_blockade.replace('{country}', tc);
    case 'drone_raid':
      return t.res_drone.replace('{country}', tc);
    case 'nuclear_strike':
      return t.res_nuclear.replace('{country}', tc);
    case 'allocate_budget':
      return t.res_budget_alloc
        .replace('{amount}', (a.amount as number).toFixed(1))
        .replace('{category}', a.category ?? '');
    case 'research_tech':
      return ar.success ? t.res_research_ok : (ar.message || t.res_generic_fail);
    case 'cancel_research':
      return t.res_research_cancel;
    case 'declare_war':
      return t.res_declare_war.replace('{country}', tc);
    case 'propose_peace':
      return t.res_peace.replace('{country}', tc);
    case 'propose_alliance':
      return t.res_alliance.replace('{country}', tc);
    case 'propose_trade':
    case 'counter_trade':
      return t.res_trade_prop.replace('{country}', tc);
    case 'arms_deal':
      return t.res_arms_deal.replace('{country}', tc);
    case 'propose_sanction':
      return t.res_sanction.replace('{country}', tc);
    default:
      return ar.success ? t.res_generic_ok : (ar.message || t.res_generic_fail);
  }
}

export function ActionToast() {
  const lastActionResult = useGameStore((s) => s.lastActionResult);
  const { t } = useLocaleStore();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(lastActionResult);

  useEffect(() => {
    if (lastActionResult && lastActionResult !== current) {
      setCurrent(lastActionResult);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [lastActionResult, current]);

  if (!visible || !current) return null;

  const message = localizeActionMessage(t, current);

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-slide-up">
      <div
        className={`rounded border px-4 py-3 shadow-lg max-w-md ${
          current.success
            ? 'bg-bg-secondary border-accent-green/50'
            : 'bg-bg-secondary border-severity-high/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-bold ${current.success ? 'text-accent-green' : 'text-severity-high'}`}>
            {current.success ? t.toast_ok : t.toast_failed}
          </span>
          <span className="text-text-primary text-sm">{message}</span>
          <button
            onClick={() => setVisible(false)}
            className="ml-auto text-text-muted hover:text-text-primary text-xs"
          >
            ✕
          </button>
        </div>
        {current.effects.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {current.effects.map((e, i) => (
              <span
                key={i}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  e.known
                    ? 'bg-bg-card text-text-secondary'
                    : 'bg-bg-card text-text-muted italic'
                }`}
              >
                {e.known ? e.description : '???'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
