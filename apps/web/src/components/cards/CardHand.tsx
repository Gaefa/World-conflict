'use client';

import { useState } from 'react';
import type { CountryState, PlayerAction } from '@conflict-game/shared-types';
import { useGameStore } from '@/stores/gameStore';
import { useLocaleStore } from '@/stores/localeStore';
import {
  CARD_BY_ID, DOMAINS, MAX_ENERGY, requirementMet,
  type CardCategory, type CardCtx, type CardRequirement,
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

const DOMAIN_STYLE: Record<CardCategory, { border: string; text: string; icon: string }> = {
  military: { border: 'border-severity-high/60', text: 'text-severity-high', icon: '⚔️' },
  economy: { border: 'border-accent-green/60', text: 'text-accent-green', icon: '🏦' },
  diplomacy: { border: 'border-accent-blue/60', text: 'text-accent-blue', icon: '🕊️' },
  covert: { border: 'border-accent-amber/60', text: 'text-accent-amber', icon: '🕵️' },
};

function cardName(t: Translations, id: string): string {
  return (t as unknown as Record<string, string>)[`card_name_${id}`] ?? id;
}
function cardDesc(t: Translations, id: string): string {
  return (t as unknown as Record<string, string>)[`card_desc_${id}`] ?? '';
}
function domainName(t: Translations, d: CardCategory): string {
  return (t as unknown as Record<string, string>)[`card_domain_${d}`] ?? d;
}
function requirementLabel(t: Translations, req: CardRequirement): string {
  const kind = {
    influence: t.card_req_influence,
    navy: t.card_req_navy,
    airforce: t.card_req_airforce,
    warheads: t.card_req_warheads,
    army: t.card_req_army,
  }[req.kind];
  return `${t.card_req_prefix} ${req.amount} ${kind}`;
}

export function CardHand({
  country, selectedCountryCode, playerCountryCode, home, warEnemies, onAction, countryNames,
}: Props) {
  const { t } = useLocaleStore();
  const laneEnergy = useGameStore((s) => s.laneEnergy);
  const laneHands = useGameStore((s) => s.laneHands);
  const consumeCard = useGameStore((s) => s.consumeCard);
  const discardCard = useGameStore((s) => s.discardCard);
  const [hint, setHint] = useState<string | null>(null);

  const target = selectedCountryCode !== playerCountryCode ? selectedCountryCode : null;

  const flash = (msg: string) => {
    setHint(msg);
    setTimeout(() => setHint(null), 2500);
  };

  const play = (cardId: string, domain: CardCategory) => {
    const def = CARD_BY_ID[cardId];
    if (!def) return;
    if (laneEnergy[domain] < def.energy) return;
    const cost = def.budgetCost?.(country);
    if (cost !== undefined && country.economy.budget < cost) return;
    if (!requirementMet(def.requirement, country)) return;

    if (def.needsTarget && !target) {
      flash(t.cards_need_target);
      return;
    }

    const ctx: CardCtx = { target, country, home, warEnemies };
    const action = def.build(ctx);
    if (!action) {
      flash(t.cards_need_target);
      return;
    }

    onAction(action);
    consumeCard(cardId, def.energy, domain);
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5">
      {hint && (
        <div className="bg-bg-secondary border border-accent-amber/50 text-accent-amber text-xs px-3 py-1.5 rounded shadow-lg">
          {hint}
        </div>
      )}

      <div className="flex items-start gap-2">
        {DOMAINS.map((domain) => {
          const style = DOMAIN_STYLE[domain];
          const hand = laneHands[domain] ?? [];
          const energy = laneEnergy[domain] ?? 0;

          return (
            <div key={domain} className="flex flex-col gap-1 bg-bg-primary/40 rounded-lg p-1.5">
              {/* Lane header: domain + energy */}
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wide ${style.text}`}>
                  {style.icon} {domainName(t, domain)}
                </span>
                <span className="text-accent-amber font-bold text-xs leading-none">
                  ⚡{energy}<span className="text-text-muted text-[9px]">/{MAX_ENERGY}</span>
                </span>
              </div>

              {/* Lane hand */}
              <div className="flex gap-1.5 min-h-[92px]">
                {hand.length === 0 && (
                  <div className="w-[104px] flex items-center justify-center bg-bg-secondary/50 border border-dashed border-border-default rounded-lg px-2 text-center text-text-muted text-[9px] italic">
                    {t.cards_lane_locked}
                  </div>
                )}
                {hand.map((cardId) => {
                  const def = CARD_BY_ID[cardId];
                  if (!def) return null;
                  const cost = def.budgetCost?.(country);
                  const hasBudget = cost === undefined || country.economy.budget >= cost;
                  const reqOk = requirementMet(def.requirement, country);
                  const affordable = energy >= def.energy && hasBudget && reqOk;
                  const targetName = def.needsTarget && target ? countryNames[target] ?? target : null;

                  return (
                    <button
                      key={cardId}
                      onClick={() => play(cardId, domain)}
                      disabled={!affordable}
                      className={`group relative w-[104px] bg-bg-secondary border ${style.border} rounded-lg p-1.5 text-left transition-all cursor-pointer animate-slide-up
                        ${affordable ? 'hover:-translate-y-2 hover:shadow-lg' : 'opacity-45 cursor-not-allowed'}`}
                    >
                      {/* Discard: frees the slot to redraw next tick */}
                      <span
                        role="button"
                        aria-label={t.cards_discard}
                        title={t.cards_discard}
                        onClick={(e) => { e.stopPropagation(); discardCard(cardId, domain); }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-bg-card border border-border-default text-text-muted hover:text-text-primary hover:border-accent-amber/60 flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        ↻
                      </span>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`w-4 h-4 rounded-full bg-bg-card flex items-center justify-center text-[10px] font-bold ${style.text}`}>
                          {def.energy}
                        </span>
                        <span className="text-sm leading-none">{def.icon}</span>
                      </div>
                      <div className="text-text-primary text-[10px] font-bold leading-tight mb-0.5">
                        {cardName(t, cardId)}
                      </div>
                      <div className="text-text-muted text-[9px] leading-snug min-h-[24px]">
                        {cardDesc(t, cardId)}
                      </div>
                      {cost !== undefined && (
                        <div className={`text-[9px] font-mono ${hasBudget ? 'text-text-secondary' : 'text-severity-high'}`}>
                          ${cost % 1 === 0 ? cost.toFixed(0) : cost.toFixed(1)}B
                        </div>
                      )}
                      {def.requirement && !reqOk && (
                        <div className="text-[9px] text-severity-high truncate">
                          {requirementLabel(t, def.requirement)}
                        </div>
                      )}
                      {def.needsTarget && (
                        <div className={`text-[9px] truncate ${targetName ? style.text : 'text-text-muted italic'}`}>
                          {targetName ? `→ ${targetName}` : t.cards_pick_target}
                        </div>
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
