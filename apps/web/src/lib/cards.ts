import type { CountryState, PlayerAction, ResourceType } from '@conflict-game/shared-types';
import { scaledCost } from './actionCosts';
import cardData from './cards.json';

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

/**
 * A non-budget prerequisite the engine enforces (diplomatic influence,
 * naval vessels, aircraft, warheads). Mirrored here so a card is disabled
 * up front instead of burning energy on a guaranteed-fail action.
 */
export type CardRequirement = {
  kind: 'influence' | 'navy' | 'airforce' | 'warheads';
  amount: number;
};

/** True when the acting country meets the card's non-budget requirement. */
export function requirementMet(req: CardRequirement | undefined, country: CountryState): boolean {
  if (!req) return true;
  switch (req.kind) {
    case 'influence': return country.diplomaticInfluence >= req.amount;
    case 'navy': return country.military.navy >= req.amount;
    case 'airforce': return country.military.airForce >= req.amount;
    case 'warheads': return country.military.nuclearWeapons >= req.amount;
  }
}

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
  /** Non-budget prerequisite (influence / navy / aircraft / warheads). */
  requirement?: CardRequirement;
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

/**
 * Action builders, keyed by card id. The serializable balance data
 * (energy, cost, requirement, unlock, icon) lives in cards.json; only the
 * non-serializable action logic stays here. Balance is now a data edit.
 */
const BUILDERS: Record<string, (ctx: CardCtx) => PlayerAction | null> = {
  recruit: (ctx) => ctx.home ? {
    type: 'create_army', armyType: 'infantry', size: 10_000,
    name: `Division-${Date.now() % 10000}`,
    latitude: ctx.home.lat, longitude: ctx.home.lng,
  } : null,
  invest: () => ({ type: 'allocate_budget', category: 'economy', amount: 10 }),
  social: () => ({ type: 'allocate_budget', category: 'social', amount: 5 }),
  trade: (ctx) => ctx.target ? {
    type: 'propose_trade', targetCountry: ctx.target,
    offers: [{ resource: surplusResource(ctx.country), amount: 8 }],
    requests: [], duration: 12,
  } : null,
  alliance: (ctx) => ctx.target ? { type: 'propose_alliance', targetCountry: ctx.target } : null,
  sanctions: (ctx) => ctx.target ? { type: 'propose_sanction', targetCountry: ctx.target } : null,
  stockpile: (ctx) => ({ type: 'build_stockpile', resource: deficitResource(ctx.country), months: 3 }),
  declare_war: (ctx) => ctx.target ? { type: 'declare_war', targetCountry: ctx.target } : null,
  peace: (ctx) => ctx.warEnemies[0] ? { type: 'propose_peace', targetCountry: ctx.warEnemies[0] } : null,
  mobilize: (ctx) => ctx.home ? {
    type: 'create_army', armyType: 'infantry', size: 25_000,
    name: `Mobilized-${Date.now() % 10000}`,
    latitude: ctx.home.lat, longitude: ctx.home.lng,
  } : null,
  armored_army: (ctx) => ctx.home ? {
    type: 'create_army', armyType: 'armored', size: 3_000,
    name: `Armored-${Date.now() % 10000}`,
    latitude: ctx.home.lat, longitude: ctx.home.lng,
  } : null,
  drone_raid: (ctx) => ctx.target ? { type: 'drone_raid', targetCountry: ctx.target, target: 'military' } : null,
  airstrike: (ctx) => ctx.target ? { type: 'airstrike', targetCountry: ctx.target, intensity: 'surgical' } : null,
  blockade: (ctx) => ctx.target ? { type: 'naval_blockade', targetCountry: ctx.target } : null,
  carpet_bombing: (ctx) => ctx.target ? { type: 'airstrike', targetCountry: ctx.target, intensity: 'carpet' } : null,
  nuke_tactical: (ctx) => ctx.target ? { type: 'nuclear_strike', targetCountry: ctx.target, warhead: 'tactical' } : null,
  cyber_attack: (ctx) => ctx.target ? { type: 'cyber_attack', targetCountry: ctx.target, target: 'infrastructure' } : null,
  incite: (ctx) => ctx.target ? { type: 'incite_rebellion', targetCountry: ctx.target } : null,
};

/** Budget cost spec in cards.json: a flat $B amount or a GDP-scaled base. */
type BudgetSpec = { flat: number } | { scaled: number };

interface CardData {
  energy: number;
  icon: string;
  category: CardCategory;
  needsTarget: boolean;
  unlock: 'base' | 'war' | { tech: string };
  budget?: BudgetSpec;
  requirement?: CardRequirement;
}

function budgetFn(spec: BudgetSpec | undefined): ((c: CountryState) => number) | undefined {
  if (!spec) return undefined;
  if ('flat' in spec) return () => spec.flat;
  return (c) => scaledCost(spec.scaled, c.economy.gdp);
}

// Assemble cards by merging JSON balance data with the id's action builder.
// Object insertion order is preserved, so card ordering matches cards.json.
export const CARDS: CardDef[] = Object.entries(cardData as Record<string, CardData>).map(
  ([id, d]) => ({
    id,
    energy: d.energy,
    icon: d.icon,
    category: d.category,
    needsTarget: d.needsTarget,
    unlock: d.unlock,
    budgetCost: budgetFn(d.budget),
    requirement: d.requirement,
    build: BUILDERS[id] ?? (() => null),
  }),
);

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map(c => [c.id, c]));

/** The four domain lanes, each with its own deck + energy pool. */
export const DOMAINS: CardCategory[] = ['military', 'economy', 'diplomacy', 'covert'];

// Energy and hand limits are PER LANE (each domain is independent).
export const MAX_ENERGY = 4;        // per lane; must be ≥ the priciest card (nuke = 4)
export const ENERGY_PER_TICK = 1;   // per lane, per tick
export const WAR_MILITARY_REGEN = 2; // military lane regen while at war (war economy)
export const START_ENERGY = 3;      // per lane at game start
export const MAX_HAND = 2;          // cards visible per lane

/** Per-lane energy regen for this tick, given war status (war economy boost). */
export function laneRegen(domain: CardCategory, atWar: boolean): number {
  return domain === 'military' && atWar ? WAR_MILITARY_REGEN : ENERGY_PER_TICK;
}

/** Cards available to draw given researched techs and war status. */
export function availablePool(researchedTechs: string[], atWar: boolean): CardDef[] {
  return CARDS.filter(c => {
    if (c.unlock === 'base') return true;
    if (c.unlock === 'war') return atWar;
    return researchedTechs.includes(c.unlock.tech);
  });
}

/**
 * Draw one card id for a specific domain lane, excluding ids already in
 * that lane's hand. Uniform within the domain's available pool.
 */
export function drawCard(
  domain: CardCategory,
  researchedTechs: string[],
  atWar: boolean,
  hand: string[],
  rnd: () => number = Math.random,
): string | null {
  const pool = availablePool(researchedTechs, atWar)
    .filter(c => c.category === domain && !hand.includes(c.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(rnd() * pool.length)].id;
}
