import type { Army, CountryState } from '@conflict-game/shared-types';
import type { RNG } from '../rng';

/** Calculate battle outcome between two armies */
export function resolveBattle(attacker: Army, defender: Army, rng: RNG): BattleResult {
  const attackPower = calculateCombatPower(attacker) * 1.0; // no attack bonus
  const defensePower = calculateCombatPower(defender) * 1.2; // 20% defense bonus

  const totalPower = attackPower + defensePower;
  const attackerWinChance = attackPower / totalPower;

  const roll = rng();
  const attackerWins = roll < attackerWinChance;

  // Calculate losses
  const lossFactor = 0.1 + rng() * 0.2; // 10-30% losses
  const winnerLossFactor = lossFactor * 0.5;
  const loserLossFactor = lossFactor * 1.5;

  return {
    attackerWins,
    attackerLosses: Math.floor(attacker.size * (attackerWins ? winnerLossFactor : loserLossFactor)),
    defenderLosses: Math.floor(defender.size * (attackerWins ? loserLossFactor : winnerLossFactor)),
    attackerMoraleChange: attackerWins ? 5 : -15,
    defenderMoraleChange: attackerWins ? -15 : 5,
  };
}

function calculateCombatPower(army: Army): number {
  const typeMultiplier: Record<string, number> = {
    infantry: 1.0,
    armored: 2.5,
    naval: 2.0,
    airforce: 3.0,
    special_ops: 4.0,
  };

  const mult = typeMultiplier[army.type] ?? 1.0;
  const moraleBonus = army.morale / 100;
  const expBonus = 1 + (army.experience / 100) * 0.5;

  return army.size * mult * moraleBonus * expBonus;
}

export interface BattleResult {
  attackerWins: boolean;
  attackerLosses: number;
  defenderLosses: number;
  attackerMoraleChange: number;
  defenderMoraleChange: number;
}

/** Calculate army recruitment cost */
export function recruitmentCost(type: string, size: number): number {
  const costPerUnit: Record<string, number> = {
    infantry: 0.001,    // $1K per soldier (in billions)
    armored: 0.01,      // $10M per vehicle
    naval: 0.1,         // $100M per ship
    airforce: 0.05,     // $50M per aircraft
    special_ops: 0.005, // $5M per operator
  };
  return (costPerUnit[type] ?? 0.001) * size;
}

/** Calculate army maintenance cost per tick */
export function maintenanceCost(army: Army): number {
  const costPerUnit: Record<string, number> = {
    infantry: 0.00001,
    armored: 0.0001,
    naval: 0.001,
    airforce: 0.0005,
    special_ops: 0.00005,
  };
  return (costPerUnit[army.type] ?? 0.00001) * army.size;
}
