import type { CountryState } from '@conflict-game/shared-types';

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

export const DIFFICULTY_MULTIPLIER: Record<AIDifficulty, number> = {
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
  lastProposalToHumanTick: number;
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
    lastProposalToHumanTick: 0,
    allies: [],
    enemies: [],
    priorities: computePriorities(country, strategy),
  };
}

export function computePriorities(country: CountryState, strategy: AIStrategy): AIState['priorities'] {
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
