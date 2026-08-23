import type { CountryState, PlayerAction, ResourceType } from '@conflict-game/shared-types';
import { TECH_TREE } from '@conflict-game/shared-types';
import { scaledCost } from './actionCosts';
import cardData from './cards.json';

/**
 * Action panel — a curated UI layer over the existing action system.
 * Playing a card sends a regular PlayerAction; the engine is unchanged.
 *
 * Cards are grouped into four domain lanes and are ALWAYS available once
 * unlocked — there is no deck, no draw and no hand limit. Randomly
 * withholding a lever fights the fantasy of running a country (a president
 * who "didn't draw the tax card" is nonsense), so the only gates are the
 * real ones: budget, influence, troops and researched technology.
 *
 * Unlocks:
 *   'base'           — available from the start
 *   'war'            — only while at war (situational)
 *   { tech: TechId } — appears once the tech is researched
 */

export type CardCategory = 'military' | 'diplomacy' | 'economy' | 'covert';

/** The four domain lanes of the action panel. */
export const DOMAINS: CardCategory[] = ['military', 'economy', 'diplomacy', 'covert'];

/**
 * A non-budget prerequisite the engine enforces (diplomatic influence,
 * naval vessels, aircraft, warheads, troops, military tech). Mirrored here
 * so a card is disabled up front with a reason instead of failing server-side.
 */
export type CardRequirement = {
  kind: 'influence' | 'navy' | 'airforce' | 'warheads' | 'army' | 'militaryTech';
  amount: number;
};

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
  icon: string;
  category: CardCategory;
  needsTarget: boolean;
  unlock: 'base' | 'war' | { tech: string };
  /** Budget cost in $B (mirrors engine formulas). */
  budgetCost?: (country: CountryState) => number;
  /** Non-budget prerequisite. */
  requirement?: CardRequirement;
  /** Extra availability check (e.g. research already in progress). */
  ready?: (country: CountryState) => boolean;
  /** Dynamic detail line, e.g. which tech will be researched. */
  subtitle?: (country: CountryState) => string | null;
  /** Build the action. Returns null if context is insufficient. */
  build: (ctx: CardCtx) => PlayerAction | null;
}

/** True when the acting country meets the card's non-budget requirement. */
export function requirementMet(req: CardRequirement | undefined, country: CountryState): boolean {
  if (!req) return true;
  switch (req.kind) {
    case 'influence': return country.diplomaticInfluence >= req.amount;
    case 'navy': return country.military.navy >= req.amount;
    case 'airforce': return country.military.airForce >= req.amount;
    case 'warheads': return country.military.nuclearWeapons >= req.amount;
    case 'army': return country.military.army >= req.amount;
    case 'militaryTech': return country.military.techLevel >= req.amount;
  }
}

// ── Resource pickers ──

/** Resource with the biggest surplus — offered in trades. */
function surplusResource(country: CountryState): ResourceType {
  const rs = country.resourceState ?? {};
  let best: ResourceType = 'oil';
  let bestVal = -Infinity;
  for (const [r, b] of Object.entries(rs)) {
    if (!b) continue;
    const surplus = b.production - b.consumption;
    if (surplus > bestVal) { bestVal = surplus; best = r as ResourceType; }
  }
  return best;
}

/** Resource with the biggest deficit — stockpiled first. */
function deficitResource(country: CountryState): ResourceType {
  const rs = country.resourceState ?? {};
  let best: ResourceType = 'oil';
  let bestVal = 0;
  for (const [r, b] of Object.entries(rs)) {
    if (b && b.deficit > bestVal) { bestVal = b.deficit; best = r as ResourceType; }
  }
  return best;
}

/** Highest-production resource — the one worth squeezing the market with. */
function topProductionResource(country: CountryState): { resource: ResourceType; production: number } {
  const rs = country.resourceState ?? {};
  let best: ResourceType = 'oil';
  let bestVal = 0;
  for (const [r, b] of Object.entries(rs)) {
    if (b && b.production > bestVal) { bestVal = b.production; best = r as ResourceType; }
  }
  return { resource: best, production: bestVal };
}

// ── Research ──

/**
 * Next technology the country can start in one of these branches: lowest
 * tier first, cheapest as a tiebreak. Returns null while another research
 * is running or when the branches are exhausted.
 */
function nextResearchTech(country: CountryState, branches: string[]) {
  const tech = country.tech;
  if (!tech || tech.activeResearch) return null;
  const done = new Set(tech.researchedTechs);
  const candidates = Object.values(TECH_TREE)
    .filter(t => branches.includes(t.branch))
    .filter(t => !done.has(t.id))
    .filter(t => t.prerequisites.every(p => done.has(p)))
    .sort((a, b) => a.tier - b.tier || a.cost - b.cost);
  return candidates[0] ?? null;
}

// ── Action builders, keyed by card id ──

const BUILDERS: Record<string, (ctx: CardCtx) => PlayerAction | null> = {
  // Military
  recruit: (ctx) => ctx.home ? {
    type: 'create_army', armyType: 'infantry', size: 10_000,
    name: 'Division', latitude: ctx.home.lat, longitude: ctx.home.lng,
  } : null,
  armored_army: (ctx) => ctx.home ? {
    type: 'create_army', armyType: 'armored', size: 3_000,
    name: 'Armored Corps', latitude: ctx.home.lat, longitude: ctx.home.lng,
  } : null,
  mobilize: (ctx) => ctx.home ? {
    type: 'create_army', armyType: 'infantry', size: 25_000,
    name: 'Mobilized Force', latitude: ctx.home.lat, longitude: ctx.home.lng,
  } : null,
  declare_war: (ctx) => ctx.target ? { type: 'declare_war', targetCountry: ctx.target } : null,
  invade: (ctx) => ctx.target ? { type: 'invasion', targetCountry: ctx.target, committedForces: 0.5 } : null,
  drone_raid: (ctx) => ctx.target ? { type: 'drone_raid', targetCountry: ctx.target, target: 'military' } : null,
  airstrike: (ctx) => ctx.target ? { type: 'airstrike', targetCountry: ctx.target, intensity: 'surgical' } : null,
  blockade: (ctx) => ctx.target ? { type: 'naval_blockade', targetCountry: ctx.target } : null,
  carpet_bombing: (ctx) => ctx.target ? { type: 'airstrike', targetCountry: ctx.target, intensity: 'carpet' } : null,
  nuke_tactical: (ctx) => ctx.target ? { type: 'nuclear_strike', targetCountry: ctx.target, warhead: 'tactical' } : null,

  // Economy
  invest: () => ({ type: 'allocate_budget', category: 'economy', amount: 10 }),
  social: () => ({ type: 'allocate_budget', category: 'social', amount: 5 }),
  stockpile: (ctx) => ({ type: 'build_stockpile', resource: deficitResource(ctx.country), months: 3 }),
  tax_raise: (ctx) => ({ type: 'set_tax_rate', rate: Math.min(0.6, ctx.country.economy.taxRate + 0.05) }),
  tax_cut: (ctx) => ({ type: 'set_tax_rate', rate: Math.max(0.05, ctx.country.economy.taxRate - 0.05) }),
  manipulate_price: (ctx) => ({
    type: 'manipulate_price', resource: topProductionResource(ctx.country).resource,
    direction: 'increase', method: 'production_cut',
  }),
  sanction_evasion: () => ({ type: 'sanction_evasion', method: 'shadow_fleet' }),

  // Diplomacy
  trade: (ctx) => ctx.target ? {
    type: 'propose_trade', targetCountry: ctx.target,
    offers: [{ resource: surplusResource(ctx.country), amount: 8 }],
    requests: [], duration: 12,
  } : null,
  alliance: (ctx) => ctx.target ? { type: 'propose_alliance', targetCountry: ctx.target } : null,
  sanctions: (ctx) => ctx.target ? { type: 'propose_sanction', targetCountry: ctx.target } : null,
  arms_deal: (ctx) => ctx.target ? { type: 'arms_deal', targetCountry: ctx.target, amount: 5 } : null,
  peace: (ctx) => ctx.warEnemies[0] ? { type: 'propose_peace', targetCountry: ctx.warEnemies[0] } : null,

  // Covert
  spy_op: (ctx) => ctx.target ? { type: 'launch_spy_op', targetCountry: ctx.target, opType: 'human_intel' } : null,
  counter_intel: () => ({ type: 'boost_counter_intel', amount: 5 }),
  propaganda: (ctx) => ctx.target ? { type: 'propaganda', targetCountry: ctx.target, narrative: 'anti_government' } : null,
  sabotage: (ctx) => ctx.target ? { type: 'sabotage', targetCountry: ctx.target, target: 'infrastructure' } : null,
  cyber_attack: (ctx) => ctx.target ? { type: 'cyber_attack', targetCountry: ctx.target, target: 'infrastructure' } : null,
  incite: (ctx) => ctx.target ? { type: 'incite_rebellion', targetCountry: ctx.target } : null,
  coup: (ctx) => ctx.target ? { type: 'coup_attempt', targetCountry: ctx.target } : null,
};

/** Budget cost spec in cards.json. */
type BudgetSpec = { flat: number } | { scaled: number } | { armyShare: number };

interface CardData {
  icon: string;
  category: CardCategory;
  needsTarget: boolean;
  unlock: 'base' | 'war' | { tech: string };
  budget?: BudgetSpec;
  requirement?: CardRequirement;
  /** Present on research cards — which tech branches this lane advances. */
  researchBranches?: string[];
}

function budgetFn(spec: BudgetSpec | undefined): ((c: CountryState) => number) | undefined {
  if (!spec) return undefined;
  if ('flat' in spec) return () => spec.flat;
  if ('armyShare' in spec) {
    return (c) => Math.round(Math.floor(c.military.army * spec.armyShare) * 0.00005 * 10) / 10;
  }
  return (c) => scaledCost(spec.scaled, c.economy.gdp);
}

// Assemble cards from JSON balance data + the id's action builder.
export const CARDS: CardDef[] = Object.entries(cardData as Record<string, CardData>).map(
  ([id, d]) => {
    const branches = d.researchBranches;
    if (branches) {
      // Research cards are fully derived: cost, label and action all come
      // from whichever tech is next in this lane's branches.
      return {
        id, icon: d.icon, category: d.category, needsTarget: false, unlock: d.unlock,
        budgetCost: (c) => nextResearchTech(c, branches)?.cost ?? 0,
        ready: (c) => nextResearchTech(c, branches) !== null,
        subtitle: (c) => nextResearchTech(c, branches)?.name ?? null,
        build: (ctx) => {
          const t = nextResearchTech(ctx.country, branches);
          return t ? { type: 'research_tech', techId: t.id } : null;
        },
      } satisfies CardDef;
    }
    return {
      id,
      icon: d.icon,
      category: d.category,
      needsTarget: d.needsTarget,
      unlock: d.unlock,
      budgetCost: budgetFn(d.budget),
      requirement: d.requirement,
      // Price manipulation needs 30+ production capacity in the resource.
      ready: id === 'manipulate_price'
        ? (c) => topProductionResource(c).production >= 30
        : undefined,
      build: BUILDERS[id] ?? (() => null),
    } satisfies CardDef;
  },
);

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map(c => [c.id, c]));

/** Cards unlocked for a lane, given researched techs and war status. */
export function cardsForLane(
  domain: CardCategory,
  researchedTechs: string[],
  atWar: boolean,
): CardDef[] {
  return CARDS.filter(c => {
    if (c.category !== domain) return false;
    if (c.unlock === 'base') return true;
    if (c.unlock === 'war') return atWar;
    return researchedTechs.includes(c.unlock.tech);
  });
}
