'use client';

import { BASE_PRICES } from '@conflict-game/game-logic';
import type { ResourceMarket } from '@conflict-game/shared-types';

interface PriceTickerProps {
  market: ResourceMarket;
}

/** Resources shown in the ticker, in priority order. */
const TICKER_RESOURCES = [
  'oil', 'gas', 'rareEarth', 'semiconductors', 'wheat', 'steel',
  'gold', 'lithium', 'electronics', 'coal', 'iron', 'uranium',
] as const;

const RESOURCE_ICONS: Record<string, string> = {
  oil: '🛢', gas: '💨', rareEarth: '💎', semiconductors: '💻',
  wheat: '🌾', steel: '⚙️', gold: '🥇', lithium: '🔋',
  electronics: '📱', coal: '⬛', iron: '🔩', uranium: '☢️',
};

function trend(current: number, base: number): { symbol: string; cls: string } {
  const ratio = current / base;
  if (ratio >= 1.3) return { symbol: '↑↑', cls: 'text-severity-high' };
  if (ratio >= 1.1) return { symbol: '↑', cls: 'text-amber-400' };
  if (ratio <= 0.7) return { symbol: '↓↓', cls: 'text-accent-blue' };
  if (ratio <= 0.9) return { symbol: '↓', cls: 'text-accent-green' };
  return { symbol: '→', cls: 'text-text-muted' };
}

export function PriceTicker({ market }: PriceTickerProps) {
  const entries = TICKER_RESOURCES
    .map(r => {
      const price = market.prices[r];
      const base = BASE_PRICES[r] ?? 100;
      if (!price) return null;
      const t = trend(price, base);
      return { r, price, t, icon: RESOURCE_ICONS[r] ?? '·' };
    })
    .filter(Boolean) as { r: string; price: number; t: { symbol: string; cls: string }; icon: string }[];

  if (entries.length === 0) return null;

  return (
    <div className="h-6 bg-bg-secondary border-t border-border-default flex items-center overflow-hidden shrink-0">
      <span className="text-text-muted text-xs px-2 shrink-0 border-r border-border-default">
        MARKET
      </span>
      <div className="flex items-center gap-4 px-3 overflow-x-auto no-scrollbar">
        {entries.map(({ r, price, t, icon }) => (
          <span key={r} className="flex items-center gap-1 text-xs whitespace-nowrap shrink-0">
            <span>{icon}</span>
            <span className="text-text-secondary">${price.toFixed(0)}</span>
            <span className={`font-bold ${t.cls}`}>{t.symbol}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
