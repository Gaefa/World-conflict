import type { GameState, CountryState, PlayerAction } from '@conflict-game/shared-types';
import type { RNG } from '@conflict-game/game-logic';
import type { AIState } from './personality';

export function computeIntelActions(
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
