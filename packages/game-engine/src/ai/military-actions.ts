import type { GameState, CountryState, PlayerAction } from '@conflict-game/shared-types';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import type { RNG } from '@conflict-game/game-logic';
import type { AIState } from './personality';

export function computeMilitaryActions(
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

    // March idle armies toward the enemy
    const enemySeed = SEED_COUNTRIES.find(c => c.code === enemy);
    if (enemySeed) {
      for (const army of state.armies) {
        if (army.ownerCountry === aiState.countryCode && army.status === 'idle') {
          actions.push({
            type: 'move_army',
            armyId: army.id,
            targetLat: enemySeed.latitude,
            targetLng: enemySeed.longitude,
          });
        }
      }
    }

    // Reinforce: keep building armies while at war
    const myArmies = state.armies.filter(a => a.ownerCountry === aiState.countryCode).length;
    if (myArmies < 3 && rng() < 0.4 * diff) {
      const homeSeed = SEED_COUNTRIES.find(c => c.code === aiState.countryCode);
      actions.push({
        type: 'create_army',
        armyType: 'infantry',
        name: `${aiState.countryCode}-force-${state.session.currentTick}`,
        size: Math.floor(15000 * diff),
        latitude: homeSeed?.latitude ?? 0,
        longitude: homeSeed?.longitude ?? 0,
      });
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
