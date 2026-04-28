import type { GameState, CountryState, PlayerAction, DiplomaticRelation } from '@conflict-game/shared-types';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import type { RNG } from '@conflict-game/game-logic';

// ─── AI Strategy Types ───────────────────────────────────────────────

export type AIStrategy = 'aggressive' | 'economic' | 'diplomatic' | 'defensive' | 'expansionist';
export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIPersonality {
  strategy: AIStrategy;
  aggression: number;     // 0-1: склонность к военным действиям
  diplomacy: number;      // 0-1: склонность к дипломатии
  economy: number;        // 0-1: фокус на экономику
  riskTolerance: number;  // 0-1: готовность к рискованным действиям
}

const STRATEGY_PROFILES: Record<AIStrategy, Omit<AIPersonality, 'strategy'>> = {
  aggressive:   { aggression: 0.8, diplomacy: 0.2, economy: 0.3, riskTolerance: 0.7 },
  economic:     { aggression: 0.1, diplomacy: 0.5, economy: 0.9, riskTolerance: 0.3 },
  diplomatic:   { aggression: 0.2, diplomacy: 0.9, economy: 0.5, riskTolerance: 0.4 },
  defensive:    { aggression: 0.1, diplomacy: 0.4, economy: 0.6, riskTolerance: 0.2 },
  expansionist: { aggression: 0.6, diplomacy: 0.3, economy: 0.5, riskTolerance: 0.6 },
};

const DIFFICULTY_MULTIPLIER: Record<AIDifficulty, number> = {
  easy: 0.5,    // принимает решения реже, хуже оценивает ситуацию
  normal: 1.0,
  hard: 1.5,    // агрессивнее оптимизирует, чаще действует
};

// ─── AI State per Country ────────────────────────────────────────────

export interface AIState {
  countryCode: string;
  personality: AIPersonality;
  difficulty: AIDifficulty;
  lastActionTick: number;
  allies: string[];
  enemies: string[];
  priorities: ('military' | 'economy' | 'diplomacy' | 'tech' | 'stability')[];
}

// ─── Assign strategy based on country profile ────────────────────────

export function assignStrategy(country: CountryState, code: string): AIStrategy {
  const mil = country.military.army + country.military.navy + country.military.airForce;
  const gdp = country.economy.gdp;
  const nukes = country.military.nuclearWeapons;

  // Ядерные державы — defensive/aggressive
  if (nukes > 0) {
    return gdp > 2000 ? 'expansionist' : 'defensive';
  }
  // Крупные экономики — economic
  if (gdp > 3000) return 'economic';
  // Большие армии — aggressive
  if (mil > 500000) return 'aggressive';
  // Средние страны — diplomatic
  if (gdp > 500) return 'diplomatic';
  // Маленькие страны — defensive
  return 'defensive';
}

export function createAIState(code: string, country: CountryState, difficulty: AIDifficulty = 'normal'): AIState {
  const strategy = assignStrategy(country, code);
  const profile = STRATEGY_PROFILES[strategy];
  return {
    countryCode: code,
    personality: { strategy, ...profile },
    difficulty,
    lastActionTick: 0,
    allies: [],
    enemies: [],
    priorities: computePriorities(country, strategy),
  };
}

function computePriorities(country: CountryState, strategy: AIStrategy): AIState['priorities'] {
  const priorities: AIState['priorities'] = [];

  // Критическая стабильность — всегда приоритет
  if (country.stability < 40) priorities.push('stability');
  if (country.approval < 30) priorities.push('stability');

  switch (strategy) {
    case 'aggressive':
    case 'expansionist':
      priorities.push('military', 'tech', 'economy');
      break;
    case 'economic':
      priorities.push('economy', 'tech', 'diplomacy');
      break;
    case 'diplomatic':
      priorities.push('diplomacy', 'economy', 'tech');
      break;
    case 'defensive':
      priorities.push('military', 'economy', 'stability');
      break;
  }
  return priorities;
}

// ─── Core AI Decision Engine ─────────────────────────────────────────

export function computeAIActions(
  state: GameState,
  aiState: AIState,
  currentTick: number,
  rng: RNG,
): PlayerAction[] {
  const country = state.countries[aiState.countryCode];
  if (!country) return [];

  const actions: PlayerAction[] = [];
  const p = aiState.personality;
  const diff = DIFFICULTY_MULTIPLIER[aiState.difficulty];

  // AI действует не каждый тик — зависит от difficulty
  const actionInterval = Math.max(1, Math.floor(3 / diff));
  if ((currentTick - aiState.lastActionTick) < actionInterval) return [];

  // Обновляем приоритеты
  aiState.priorities = computePriorities(country, p.strategy);
  aiState.lastActionTick = currentTick;

  // Обновляем списки врагов/союзников
  updateRelationships(state, aiState);

  // ─── Stability Crisis Actions ──────────────────────────────────
  if (country.stability < 30) {
    actions.push({ type: 'propaganda', targetCountry: aiState.countryCode, narrative: 'nationalism' });
    return actions; // В кризисе — только стабилизация
  }

  // ─── Economic Actions ──────────────────────────────────────────
  if (p.economy > 0.4 || country.economy.gdpGrowth < 0) {
    const econActions = computeEconomicActions(country, p, diff, rng);
    actions.push(...econActions);
  }

  // ─── Military Actions ──────────────────────────────────────────
  if (p.aggression > 0.3) {
    const milActions = computeMilitaryActions(state, aiState, country, diff, rng);
    actions.push(...milActions);
  }

  // ─── Diplomatic Actions ────────────────────────────────────────
  if (p.diplomacy > 0.3) {
    const diploActions = computeDiplomaticActions(state, aiState, country, diff, rng);
    actions.push(...diploActions);
  }

  // ─── Research Actions ──────────────────────────────────────────
  if (!country.tech?.activeResearch) {
    const techAction = computeResearchAction(country, p);
    if (techAction) actions.push(techAction);
  }

  // ─── Intelligence Actions ──────────────────────────────────────
  if (p.aggression > 0.4 || p.diplomacy > 0.6) {
    const intelActions = computeIntelActions(state, aiState, country, diff, rng);
    actions.push(...intelActions);
  }

  // Лимит действий за тик (easy=1, normal=2, hard=3)
  const maxActions = Math.ceil(2 * diff);
  return actions.slice(0, maxActions);
}

// ─── Sub-modules ─────────────────────────────────────────────────────

function updateRelationships(state: GameState, aiState: AIState): void {
  aiState.allies = [];
  aiState.enemies = [];

  for (const rel of state.relations) {
    if (rel.status !== 'active') continue;
    const isFrom = rel.fromCountry === aiState.countryCode;
    const isTo = rel.toCountry === aiState.countryCode;
    if (!isFrom && !isTo) continue;

    const other = isFrom ? rel.toCountry : rel.fromCountry;

    if (rel.type === 'war') {
      aiState.enemies.push(other);
    } else if (rel.type === 'alliance' || rel.type === 'trade_agreement') {
      aiState.allies.push(other);
    }
  }
}

function computeEconomicActions(
  country: CountryState,
  p: AIPersonality,
  diff: number,
  rng: RNG,
): PlayerAction[] {
  const actions: PlayerAction[] = [];

  // Adjust tax rate based on economy
  if (country.economy.gdpGrowth < -1 && country.economy.taxRate > 0.2) {
    actions.push({ type: 'set_tax_rate', rate: Math.max(0.15, country.economy.taxRate - 0.05) });
  } else if (country.economy.budget < 10 && country.economy.taxRate < 0.4) {
    actions.push({ type: 'set_tax_rate', rate: Math.min(0.45, country.economy.taxRate + 0.05) });
  }

  // Budget allocation — economic strategy focuses on economy
  if (p.economy > 0.7 && rng() < 0.3 * diff) {
    const focusCategory = p.strategy === 'aggressive' ? 'military' as const
      : p.strategy === 'economic' ? 'economy' as const
      : 'technology' as const;
    actions.push({
      type: 'allocate_budget',
      category: focusCategory,
      amount: 30,
    });
  }

  return actions;
}

function computeMilitaryActions(
  state: GameState,
  aiState: AIState,
  country: CountryState,
  diff: number,
  rng: RNG,
): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const p = aiState.personality;

  // В войне — активные военные действия
  if (aiState.enemies.length > 0) {
    const enemy = aiState.enemies[0];
    const enemyCountry = state.countries[enemy];
    if (!enemyCountry) return actions;

    const myPower = country.indexOfPower;
    const enemyPower = enemyCountry.indexOfPower;

    // Airstrike if stronger
    if (myPower > enemyPower * 0.8 && rng() < p.aggression * diff) {
      actions.push({ type: 'airstrike', targetCountry: enemy, intensity: 'conventional' });
    }

    // Cyber attack
    if (rng() < 0.3 * diff) {
      actions.push({ type: 'cyber_attack', targetCountry: enemy, target: 'military' });
    }

    // Propose peace if losing badly
    if (myPower < enemyPower * 0.5 && country.stability < 40) {
      actions.push({ type: 'propose_peace', targetCountry: enemy });
    }

    return actions;
  }

  // Не в войне — оценка угроз
  if (p.aggression > 0.6 && rng() < (p.aggression * 0.1 * diff)) {
    // Агрессивный AI ищет слабую цель
    const target = findWeakTarget(state, aiState, country);
    if (target && p.riskTolerance > 0.5) {
      // Сначала ищем повод (шпионаж, диверсия, потом война)
      if (rng() < 0.3) {
        actions.push({ type: 'sabotage', targetCountry: target, target: 'infrastructure' });
      }
    }
  }

  // Build army if military-focused
  if (p.aggression > 0.5 && rng() < 0.2 * diff) {
    const homeSeed = SEED_COUNTRIES.find(c => c.code === aiState.countryCode);
    actions.push({
      type: 'create_army',
      armyType: 'infantry',
      name: `${aiState.countryCode}-force-${Date.now()}`,
      size: Math.floor(10000 * diff),
      latitude: homeSeed?.latitude ?? 0,
      longitude: homeSeed?.longitude ?? 0,
    });
  }

  return actions;
}

function computeDiplomaticActions(
  state: GameState,
  aiState: AIState,
  country: CountryState,
  diff: number,
  rng: RNG,
): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const p = aiState.personality;

  // Ищем потенциальных союзников (нет отношений, сильные страны)
  if (aiState.allies.length < 3 && rng() < p.diplomacy * 0.3 * diff) {
    const candidate = findAllyCandidate(state, aiState, rng);
    if (candidate) {
      // Propose trade first, then alliance
      if (aiState.allies.length === 0) {
        actions.push({
          type: 'propose_trade',
          targetCountry: candidate,
          offers: [{ resource: 'oil', amount: 10 }],
          requests: [{ resource: 'electronics', amount: 5 }],
        });
      } else {
        actions.push({ type: 'propose_alliance', targetCountry: candidate });
      }
    }
  }

  // Санкции против врагов (дипломатичный подход)
  if (p.diplomacy > 0.6 && aiState.enemies.length > 0 && rng() < 0.2 * diff) {
    actions.push({
      type: 'propose_sanction',
      targetCountry: aiState.enemies[0],
    });
  }

  // Accept pending proposals
  const pending = state.relations.filter(
    r => r.toCountry === aiState.countryCode && r.status === 'proposed'
  );
  for (const proposal of pending) {
    const shouldAccept = evaluateProposal(proposal, aiState, state, rng);
    actions.push({
      type: shouldAccept ? 'accept_proposal' : 'reject_proposal',
      relationId: proposal.id,
    });
  }

  return actions;
}

function computeResearchAction(country: CountryState, p: AIPersonality): PlayerAction | null {
  if (!country.tech) return { type: 'research_tech' }; // fallback to old system

  const researched = new Set(country.tech.researchedTechs);

  // Pick branch based on personality
  type TechCategory = 'military' | 'economy' | 'cyber' | 'space';
  let preferred: TechCategory;
  switch (p.strategy) {
    case 'aggressive':
    case 'expansionist':
      preferred = 'military';
      break;
    case 'economic':
      preferred = 'economy';
      break;
    case 'diplomatic':
      preferred = 'cyber';
      break;
    case 'defensive':
      preferred = 'military';
      break;
    default:
      preferred = 'economy';
  }

  return { type: 'research_tech', category: preferred };
}

function computeIntelActions(
  state: GameState,
  aiState: AIState,
  country: CountryState,
  diff: number,
  rng: RNG,
): PlayerAction[] {
  const actions: PlayerAction[] = [];

  // Launch spy ops against enemies or neighbors
  const targets = aiState.enemies.length > 0
    ? aiState.enemies
    : findNeighborCountries(state, aiState.countryCode, rng);

  if (targets.length > 0 && rng() < 0.25 * diff) {
    const target = targets[Math.floor(rng() * targets.length)];
    const opTypes = ['human_intel', 'signal_intel', 'cyber_espionage', 'diplomatic_probe'] as const;
    const opType = opTypes[Math.floor(rng() * opTypes.length)];
    actions.push({
      type: 'launch_spy_op',
      targetCountry: target,
      opType,
    });
  }

  // Boost counter-intel if enemies exist
  if (aiState.enemies.length > 0 && rng() < 0.2 * diff) {
    actions.push({ type: 'boost_counter_intel', amount: 5 });
  }

  return actions;
}

// ─── Utility Functions ───────────────────────────────────────────────

function findWeakTarget(state: GameState, aiState: AIState, self: CountryState): string | null {
  const candidates = Object.entries(state.countries)
    .filter(([code]) =>
      code !== aiState.countryCode &&
      !aiState.allies.includes(code) &&
      !aiState.enemies.includes(code)
    )
    .filter(([, c]) => c.indexOfPower < self.indexOfPower * 0.5)
    .sort(([, a], [, b]) => a.indexOfPower - b.indexOfPower);

  return candidates.length > 0 ? candidates[0][0] : null;
}

function findAllyCandidate(state: GameState, aiState: AIState, rng: RNG): string | null {
  const candidates = Object.entries(state.countries)
    .filter(([code]) =>
      code !== aiState.countryCode &&
      !aiState.allies.includes(code) &&
      !aiState.enemies.includes(code)
    )
    .filter(([, c]) => c.stability > 40 && c.economy.gdp > 200)
    .sort(([, a], [, b]) => b.indexOfPower - a.indexOfPower);

  return candidates.length > 0 ? candidates[Math.floor(rng() * Math.min(5, candidates.length))][0] : null;
}

function findNeighborCountries(state: GameState, code: string, rng: RNG): string[] {
  // Simplified: return countries with existing relations or random sample
  const related = new Set<string>();
  for (const rel of state.relations) {
    if (rel.fromCountry === code) related.add(rel.toCountry);
    if (rel.toCountry === code) related.add(rel.fromCountry);
  }
  if (related.size > 0) return [...related];

  // Fallback: random 3 countries
  const others = Object.keys(state.countries).filter(c => c !== code);
  const shuffled = others.sort(() => rng() - 0.5);
  return shuffled.slice(0, 3);
}

function evaluateProposal(
  proposal: DiplomaticRelation,
  aiState: AIState,
  state: GameState,
  rng: RNG,
): boolean {
  const p = aiState.personality;
  const other = proposal.fromCountry;

  // Never accept from enemies
  if (aiState.enemies.includes(other)) return false;

  switch (proposal.type) {
    case 'alliance':
      // Accept alliance if diplomatic or if proposer is strong
      return p.diplomacy > 0.4 || (state.countries[other]?.indexOfPower ?? 0) > 40;

    case 'trade_agreement':
      // Usually accept trade
      return p.economy > 0.2 || rng() < 0.7;

    case 'non_aggression':
      // Accept if not aggressive
      return p.aggression < 0.7;

    case 'war':
      // Join war only if aggressive and target is weak
      return p.aggression > 0.6 && p.riskTolerance > 0.5;

    case 'sanction':
      // Support sanctions from allies
      return aiState.allies.includes(other) && p.diplomacy > 0.3;

    default:
      return rng() < 0.5;
  }
}
