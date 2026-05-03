'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useLocaleStore } from '@/stores/localeStore';
import type { ActionResult } from '@conflict-game/shared-types';
import type { Translations } from '@/lib/i18n/types';

function localizeActionMessage(t: Translations, ar: ActionResult): string {
  const a = ar.action;

  switch (a.type) {
    case 'airstrike': {
      const intMap: Record<string, string> = {
        surgical: t.res_int_surgical,
        conventional: t.res_int_conventional,
        carpet: t.res_int_carpet,
      };
      return t.res_airstrike
        .replace('{intensity}', intMap[a.intensity] ?? a.intensity)
        .replace('{country}', a.targetCountry);
    }
    case 'invasion':
      return (ar.success ? t.res_invasion_ok : t.res_invasion_fail).replace('{country}', a.targetCountry);
    case 'naval_blockade':
      return t.res_blockade.replace('{country}', a.targetCountry);
    case 'drone_raid':
      return t.res_drone.replace('{country}', a.targetCountry);
    case 'nuclear_strike':
      return t.res_nuclear.replace('{country}', a.targetCountry);
    case 'allocate_budget':
      return t.res_budget_alloc
        .replace('{amount}', a.amount.toFixed(1))
        .replace('{category}', a.category ?? '');
    case 'research_tech':
      return ar.success ? t.res_research_ok : (ar.message || t.res_generic_fail);
    case 'cancel_research':
      return t.res_research_cancel;
    case 'declare_war':
      return t.res_declare_war.replace('{country}', a.targetCountry);
    case 'propose_peace':
      return t.res_peace.replace('{country}', a.targetCountry);
    case 'propose_alliance':
      return t.res_alliance.replace('{country}', a.targetCountry);
    case 'propose_trade':
      return t.res_trade_prop.replace('{country}', a.targetCountry);
    case 'counter_trade':
      return t.res_trade_prop.replace('{country}', '');
    case 'arms_deal':
      return t.res_arms_deal.replace('{country}', a.targetCountry);
    case 'propose_sanction':
      return t.res_sanction.replace('{country}', a.targetCountry);
    default:
      return ar.success ? t.res_generic_ok : (ar.message || t.res_generic_fail);
  }
}

export function ActionToast() {
  const lastActionResult = useGameStore((s) => s.lastActionResult);
  const { t } = useLocaleStore();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(lastActionResult);
  // Ref tracks the last result we've already shown — avoids listing `current`
  // in the effect deps (which would re-trigger on the same tick).
  const seenRef = useRef(lastActionResult);

  useEffect(() => {
    if (lastActionResult && lastActionResult !== seenRef.current) {
      seenRef.current = lastActionResult;
      setCurrent(lastActionResult);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [lastActionResult]);

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
            {current.effects.map((e, i) => {
              // Highlight casualty comparison rows for invasion
              const isCasualty = e.known && (
                e.description.includes('losses:') || e.description.includes('Committed')
              );
              return (
                <span
                  key={i}
                  className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                    !e.known
                      ? 'bg-bg-card text-text-muted italic'
                      : isCasualty
                      ? 'bg-severity-high/15 text-severity-high border border-severity-high/30'
                      : 'bg-bg-card text-text-secondary'
                  }`}
                >
                  {e.known ? e.description : '???'}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
