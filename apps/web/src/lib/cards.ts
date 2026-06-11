import type { CountryState, PlayerAction, ResourceType } from '@conflict-game/shared-types';
import { scaledCost } from './actionCosts';

/**
 * Card system (v0.7 prototype) — a curated UI layer over the existing
 * action system. Playing a card sends a regular PlayerAction; the engine
 * is unchanged. Energy is client-enforced for now (singleplayer-first).
 *
 * Unlocks:
 *   'base'           — in every deck from the start
 *   'war'            — appears only while at war (situational)
 *   { tech: TechId } — added to the pool once the tech is researched
 */

export type CardCategory = 'military' | 'diplomacy' | 'economy' | 'covert';

export interface CardCtx {
  /** Selected country on the globe (target). */
  target: string | null;
  country: CountryState;
  /** Player country home coordinates (for army placement). */
  home: { lat: number; lng: number } | null;
  /** Country codes the player is at war with. */
  warEnemies: string[];
}

export interface CardDef {
  id: string;
  energy: number;
  icon: string;
  category: CardCategory;
  needsTarget: boolean;
  unlock: 'base' | 'war' | { tech: string };
  /**
   * Budget cost in $B (mirrors engine formulas) — card is disabled when the
   * player can't afford it, so a play never burns energy on a failed action.
   */
  budgetCost?: (country: CountryState) => number;
  /** Build the action. Returns null if context is insufficient. */
  build: (ctx: CardCtx) => PlayerAction | null;
}

/** Pick the resource with the biggest surplus to offer in trades. */
function surplusResource(country: CountryState): ResourceType {
  const rs = country.resourceState ?? {};
  let best: ResourceType = 'oil';
  let bestVal = -Infinity;
  for (const [r, b] of Object.entries(rs)) {
    if (!b) continue;
    const surplus = b.production - b.consumption;
    if (surplus > bestVal) {
      bestVal = surplus;
      best = r as ResourceType;
    }
  }
  return best;
}

/** Pick the resource with the biggest deficit to stockpile. */
function deficitResource(country: CountryState): ResourceType {
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
}

export const CARDS: CardDef[] = [
  // ── Base deck ──
  {
    id: 'recruit', energy: 1, icon: '🪖', category: 'military', needsTarget: false, unlock: 'base',
    budgetCost: () => 10, // 10K infantry × $1K
    build: (ctx) => ctx.home ? {
      type: 'create_army', armyType: 'infantry', size: 10_000,
      name: `Division-${Date.now() % 10000}`,
      latitude: ctx.home.lat, longitude: ctx.home.lng,
    } : null,
  },
  {
    id: 'invest', energy: 1, icon: '🏗️', category: 'economy', needsTarget: false, unlock: 'base',
    budgetCost: () => 10,
    build: () => ({ type: 'allocate_budget', category: 'economy', amount: 10 }),
  },
  {
    id: 'social', energy: 1, icon: '🏥', category: 'economy', needsTarget: false, unlock: 'base',
    budgetCost: () => 5,
    build: () => ({ type: 'allocate_budget', category: 'social', amount: 5 }),
  },
  {
    id: 'trade', energy: 1, icon: '📦', category: 'diplomacy', needsTarget: true, unlock: 'base',
    build: (ctx) => ctx.target ? {
      type: 'propose_trade', targetCountry: ctx.target,
      offers: [{ resource: surplusResource(ctx.country), amount: 8 }],
      requests: [], duration: 12,
    } : null,
  },
  {
    id: 'alliance', energy: 2, icon: '🤝', category: 'diplomacy', needsTarget: true, unlock: 'base',
    build: (ctx) => ctx.target ? { type: 'propose_alliance', targetCountry: ctx.target } : null,
  },
  {
    id: 'sanctions', energy: 2, icon: '🚫', category: 'diplomacy', needsTarget: true, unlock: 'base',
    build: (ctx) => ctx.target ? { type: 'propose_sanction', targetCountry: ctx.target } : null,
  },
  {
    id: 'stockpile', energy: 1, icon: '🛢️', category: 'economy', needsTarget: false, unlock: 'base',
    build: (ctx) => ({ type: 'build_stockpile', resource: deficitResource(ctx.country), months: 3 }),
  },
  {
    id: 'declare_war', energy: 3, icon: '⚔️', category: 'military', needsTarget: true, unlock: 'base',
    build: (ctx) => ctx.target ? { type: 'declare_war', targetCountry: ctx.target } : null,
  },

  // ── War situational ──
  {
    id: 'peace', energy: 1, icon: '🕊️', category: 'diplomacy', needsTarget: false, unlock: 'war',
    build: (ctx) => ctx.warEnemies[0]
      ? { type: 'propose_peace', targetCountry: ctx.warEnemies[0] }
      : null,
  },
  {
    id: 'mobilize', energy: 2, icon: '📯', category: 'military', needsTarget: false, unlock: 'war',
    budgetCost: () => 25, // 25K infantry × $1K
    build: (ctx) => ctx.home ? {
      type: 'create_army', armyType: 'infantry', size: 25_000,
      name: `Mobilized-${Date.now() % 10000}`,
      latitude: ctx.home.lat, longitude: ctx.home.lng,
    } : null,
  },

  // ── Tech-unlocked ──
  {
    id: 'armored_army', energy: 2, icon: '🛡️', category: 'military', needsTarget: false,
    unlock: { tech: 'mil_2' },
    budgetCost: () => 30, // 3K vehicles × $10M
    build: (ctx) => ctx.home ? {
      type: 'create_army', armyType: 'armored', size: 3_000,
      name: `Armored-${Date.now() % 10000}`,
      latitude: ctx.home.lat, longitude: ctx.home.lng,
    } : null,
  },
  {
    id: 'drone_raid', energy: 2, icon: '🛩️', category: 'military', needsTarget: true,
    unlock: { tech: 'mil_3' },
    budgetCost: (c) => scaledCost(3, c.economy.gdp),
    build: (ctx) => ctx.target ? { type: 'drone_raid', targetCountry: ctx.target, target: 'military' } : null,
  },
  {
    id: 'airstrike', energy: 2, icon: '✈️', category: 'military', needsTarget: true,
    unlock: { tech: 'mil_5' },
    budgetCost: (c) => scaledCost(2, c.economy.gdp),
    build: (ctx) => ctx.target ? { type: 'airstrike', targetCountry: ctx.target, intensity: 'surgical' } : null,
  },
  {
    id: 'blockade', energy: 2, icon: '⚓', category: 'military', needsTarget: true,
    unlock: { tech: 'mil_6' },
    budgetCost: (c) => scaledCost(5, c.economy.gdp),
    build: (ctx) => ctx.target ? { type: 'naval_blockade', targetCountry: ctx.target } : null,
  },
  {
    id: 'carpet_bombing', energy: 3, icon: '💥', category: 'military', needsTarget: true,
    unlock: { tech: 'mil_7' },
    budgetCost: (c) => scaledCost(20, c.economy.gdp),
    build: (ctx) => ctx.target ? { type: 'airstrike', targetCountry: ctx.target, intensity: 'carpet' } : null,
  },
  {
    id: 'nuke_tactical', energy: 4, icon: '☢️', category: 'military', needsTarget: true,
    unlock: { tech: 'mil_9' },
    build: (ctx) => ctx.target ? { type: 'nuclear_strike', targetCountry: ctx.target, warhead: 'tactical' } : null,
  },
  {
    id: 'cyber_attack', energy: 2, icon: '💻', category: 'covert', needsTarget: true,
    unlock: { tech: 'cyber_3' },
    budgetCost: () => 5,
    build: (ctx) => ctx.target ? { type: 'cyber_attack', targetCountry: ctx.target, target: 'infrastructure' } : null,
  },
  {
    id: 'incite', energy: 3, icon: '🔥', category: 'covert', needsTarget: true,
    unlock: { tech: 'intel_1' },
    budgetCost: () => 8,
    build: (ctx) => ctx.target ? { type: 'incite_rebellion', targetCountry: ctx.target } : null,
  },
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map(c => [c.id, c]));

export const MAX_ENERGY = 5;
export const ENERGY_PER_TICK = 2;
export const MAX_HAND = 5;

/** Cards available to draw given researched techs and war status. */
export function availablePool(researchedTechs: string[], atWar: boolean): CardDef[] {
  return CARDS.filter(c => {
    if (c.unlock === 'base') return true;
    if (c.unlock === 'war') return atWar;
    return researchedTechs.includes(c.unlock.tech);
  });
}

/**
 * Draw one card id from the pool, excluding ids already in hand.
 * At war, military cards are 3× more likely.
 */
export function drawCard(
  researchedTechs: string[],
  atWar: boolean,
  hand: string[],
  rnd: () => number = Math.random,
): string | null {
  const pool = availablePool(researchedTechs, atWar).filter(c => !hand.includes(c.id));
  if (pool.length === 0) return null;

  const weights = pool.map(c => (atWar && c.category === 'military' ? 3 : 1));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rnd() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i].id;
  }
  return pool[pool.length - 1].id;
}
