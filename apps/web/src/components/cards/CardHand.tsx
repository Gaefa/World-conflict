'use client';

import { useState } from 'react';
import type { CountryState, PlayerAction } from '@conflict-game/shared-types';
import { useGameStore } from '@/stores/gameStore';
import { useLocaleStore } from '@/stores/localeStore';
import { CARD_BY_ID, MAX_ENERGY, type CardCategory, type CardCtx } from '@/lib/cards';
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

const CATEGORY_STYLE: Record<CardCategory, { border: string; text: string }> = {
  military: { border: 'border-severity-high/60', text: 'text-severity-high' },
  diplomacy: { border: 'border-accent-blue/60', text: 'text-accent-blue' },
  economy: { border: 'border-accent-green/60', text: 'text-accent-green' },
  covert: { border: 'border-accent-amber/60', text: 'text-accent-amber' },
};

function cardName(t: Translations, id: string): string {
  return (t as unknown as Record<string, string>)[`card_name_${id}`] ?? id;
}
function cardDesc(t: Translations, id: string): string {
  return (t as unknown as Record<string, string>)[`card_desc_${id}`] ?? '';
}

export function CardHand({
  country, selectedCountryCode, playerCountryCode, home, warEnemies, onAction, countryNames,
}: Props) {
  const { t } = useLocaleStore();
  const cardEnergy = useGameStore((s) => s.cardEnergy);
  const cardHand = useGameStore((s) => s.cardHand);
  const consumeCard = useGameStore((s) => s.consumeCard);
  const [hint, setHint] = useState<string | null>(null);

  const target = selectedCountryCode !== playerCountryCode ? selectedCountryCode : null;

  const play = (cardId: string) => {
    const def = CARD_BY_ID[cardId];
    if (!def) return;
    if (cardEnergy < def.energy) return;

    if (def.needsTarget && !target) {
      setHint(t.cards_need_target);
      setTimeout(() => setHint(null), 2500);
      return;
    }

    const ctx: CardCtx = { target, country, home, warEnemies };
    const action = def.build(ctx);
    if (!action) {
      setHint(t.cards_need_target);
      setTimeout(() => setHint(null), 2500);
      return;
    }

    onAction(action);
    consumeCard(cardId, def.energy);
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5">
      {hint && (
        <div className="bg-bg-secondary border border-accent-amber/50 text-accent-amber text-xs px-3 py-1.5 rounded shadow-lg">
          {hint}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Energy */}
        <div className="flex flex-col items-center gap-0.5 mb-1 mr-1">
          <span className="text-accent-amber font-bold text-lg leading-none">
            ⚡{cardEnergy}
            <span className="text-text-muted text-xs">/{MAX_ENERGY}</span>
          </span>
          <span className="text-text-muted text-[9px]">+2/{t.cards_per_tick}</span>
        </div>

        {/* Hand */}
        {cardHand.length === 0 && (
          <div className="bg-bg-secondary/80 border border-border-default rounded px-4 py-3 text-text-muted text-xs">
            {t.cards_empty}
          </div>
        )}
        {cardHand.map((cardId) => {
          const def = CARD_BY_ID[cardId];
          if (!def) return null;
          const affordable = cardEnergy >= def.energy;
          const style = CATEGORY_STYLE[def.category];
          const targetName = def.needsTarget && target ? countryNames[target] ?? target : null;

          return (
            <button
              key={cardId}
              onClick={() => play(cardId)}
              disabled={!affordable}
              className={`group w-[118px] bg-bg-secondary border ${style.border} rounded-lg p-2 text-left transition-all cursor-pointer
                ${affordable ? 'hover:-translate-y-2 hover:shadow-lg' : 'opacity-45 cursor-not-allowed'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`w-5 h-5 rounded-full bg-bg-card flex items-center justify-center text-[11px] font-bold ${style.text}`}>
                  {def.energy}
                </span>
                <span className="text-base leading-none">{def.icon}</span>
              </div>
              <div className="text-text-primary text-[11px] font-bold leading-tight mb-0.5">
                {cardName(t, cardId)}
              </div>
              <div className="text-text-muted text-[10px] leading-snug min-h-[26px]">
                {cardDesc(t, cardId)}
              </div>
              {def.needsTarget && (
                <div className={`text-[9px] mt-1 truncate ${targetName ? style.text : 'text-text-muted italic'}`}>
                  {targetName ? `→ ${targetName}` : t.cards_pick_target}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
