import type { CountryState, PlayerAction } from '@conflict-game/shared-types';
import type { RNG } from '@conflict-game/game-logic';
import type { AIPersonality } from './personality';

export function computeEconomicActions(
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

export function computeResearchAction(country: CountryState, p: AIPersonality): PlayerAction | null {
  if (!country.tech) return { type: 'research_tech' }; // fallback to old system

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
