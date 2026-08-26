'use client';

import { useState } from 'react';
import type { CountryState, PlayerAction } from '@conflict-game/shared-types';
import { useLocaleStore } from '@/stores/localeStore';
import {
  cardsForLane, DOMAINS, requirementMet,
  type CardCategory, type CardCtx, type CardDef, type CardRequirement,
} from '@/lib/cards';
import type { Translations } from '@/lib/i18n/types';

interface Props {
  country: CountryState;
  selectedCountryCode: string | null;
  playerCountryCode: string;
  home: { lat: number; lng: number } | null;
  warEnemies: string[];
  onAction: (action: PlayerAction) => void;
  countryNames: Record<string, string>;
}

const DOMAIN_STYLE: Record<CardCategory, { text: string; border: string; icon: string }> = {
  military: { text: 'text-severity-high', border: 'border-severity-high/40', icon: '⚔️' },
  economy: { text: 'text-accent-green', border: 'border-accent-green/40', icon: '🏦' },
  diplomacy: { text: 'text-accent-blue', border: 'border-accent-blue/40', icon: '🕊️' },
  covert: { text: 'text-accent-amber', border: 'border-accent-amber/40', icon: '🕵️' },
};

const tr = (t: Translations, key: string): string =>
  (t as unknown as Record<string, string>)[key] ?? key;

function requirementLabel(t: Translations, req: CardRequirement): string {
  const kind = {
    influence: t.card_req_influence,
    navy: t.card_req_navy,
    airforce: t.card_req_airforce,
    warheads: t.card_req_warheads,
    army: t.card_req_army,
    militaryTech: t.card_req_militaryTech,
  }[req.kind];
  return `${t.card_req_prefix} ${req.amount} ${kind}`;
}

/** Why the action can't be taken right now — shown in place of the price. */
function blockedReason(
  t: Translations, def: CardDef, country: CountryState,
  cost: number | undefined, needsTargetButNone: boolean,
): string | null {
  if (def.ready && !def.ready(country)) {
    return def.subtitle ? t.card_research_busy : t.card_not_ready;
  }
  if (def.requirement && !requirementMet(def.requirement, country)) {
    return requirementLabel(t, def.requirement);
  }
  if (cost !== undefined && country.economy.budget < cost) return t.card_no_budget;
  if (needsTargetButNone) return t.cards_pick_target;
  return null;
}

export function ActionPanel({
  country, selectedCountryCode, playerCountryCode, home, warEnemies, onAction, countryNames,
}: Props) {
  const { t } = useLocaleStore();
  const [flash, setFlash] = useState<string | null>(null);

  const target = selectedCountryCode !== playerCountryCode ? selectedCountryCode : null;
  const atWar = warEnemies.length > 0;
  const techs = country.tech?.researchedTechs ?? [];
  const targetName = target ? countryNames[target] ?? target : null;

  const play = (def: CardDef) => {
    const action = def.build({ target, country, home, warEnemies });
    if (!action) {
      setFlash(t.cards_need_target);
      setTimeout(() => setFlash(null), 2500);
      return;
    }
    onAction(action);
    setFlash(`${tr(t, `card_name_${def.id}`)} →`);
    setTimeout(() => setFlash(null), 1200);
  };

  return (
    <div className="border-t border-border-default bg-bg-primary/95">
      {/* War is the one state change the panel must announce: three cards
          quietly appear in the military lane and nothing else marks it. */}
      {atWar && (
        <div className="flex items-center justify-center gap-2 bg-severity-high/15 border-b border-severity-high/40 px-2 py-1">
          <span className="text-severity-high text-[11px] font-bold uppercase tracking-wider">
            ⚔ {t.war_mode_banner}
          </span>
          <span className="text-text-secondary text-[11px]">
            {t.war_mode_against} {warEnemies.map(c => countryNames[c] ?? c).join(', ')}
          </span>
          <span className="text-text-muted text-[10px] italic">— {t.war_panel_tip}</span>
        </div>
      )}

      {flash && (
        <div className="text-center text-xs text-accent-amber py-0.5">{flash}</div>
      )}

      <div className="grid grid-cols-4 gap-px bg-border-default/40">
        {DOMAINS.map((domain) => {
          const style = DOMAIN_STYLE[domain];
          const cards = cardsForLane(domain, techs, atWar);

          return (
            <div key={domain} className="bg-bg-primary flex flex-col">
              <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
                {style.icon} {tr(t, `card_domain_${domain}`)}
              </div>

              <div className="flex flex-col gap-px overflow-y-auto max-h-[168px] px-1 pb-1">
                {cards.map((def) => {
                  const cost = def.budgetCost?.(country);
                  const needsTargetButNone = def.needsTarget && !target;
                  const reason = blockedReason(t, def, country, cost, needsTargetButNone);
                  const disabled = reason !== null;
                  const subtitle = def.subtitle?.(country);

                  return (
                    <button
                      key={def.id}
                      onClick={() => play(def)}
                      disabled={disabled}
                      title={subtitle ?? tr(t, `card_desc_${def.id}`)}
                      className={`group flex items-center gap-1.5 rounded px-1.5 py-1 text-left border transition-colors
                        ${disabled
                          ? 'border-transparent opacity-40 cursor-not-allowed'
                          : `border-transparent hover:bg-bg-secondary hover:${style.border} cursor-pointer`}`}
                    >
                      <span className="text-sm leading-none w-4 shrink-0">{def.icon}</span>

                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-text-primary text-[11px] font-semibold leading-tight truncate">
                          {tr(t, `card_name_${def.id}`)}
                        </span>
                        <span className="text-text-muted text-[9px] leading-tight truncate">
                          {reason
                            ?? subtitle
                            ?? (def.needsTarget && targetName ? `→ ${targetName}` : tr(t, `card_desc_${def.id}`))}
                        </span>
                      </span>

                      {cost !== undefined && cost > 0 && (
                        <span className={`text-[9px] font-mono shrink-0 ${
                          country.economy.budget >= cost ? 'text-text-secondary' : 'text-severity-high'
                        }`}>
                          ${cost % 1 === 0 ? cost.toFixed(0) : cost.toFixed(1)}B
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
