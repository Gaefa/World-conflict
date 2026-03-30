import type { CountryState } from '@conflict-game/shared-types';

/** Calculate stability change for a tick */
export function processStabilityTick(country: CountryState, isAtWar: boolean, sanctionCount: number): StabilityDelta {
  let stabilityDelta = 0;
  let approvalDelta = 0;

  // War reduces stability
  if (isAtWar) {
    stabilityDelta -= 0.5;
    approvalDelta -= 0.3;
  }

  // Sanctions reduce stability
  stabilityDelta -= sanctionCount * 0.2;

  // High GDP growth improves approval
  if (country.economy.gdpGrowth > 2) {
    approvalDelta += 0.1;
  } else if (country.economy.gdpGrowth < -1) {
    approvalDelta -= 0.3;
    stabilityDelta -= 0.1;
  }

  // High inflation hurts
  if (country.economy.inflation > 10) {
    approvalDelta -= 0.2;
    stabilityDelta -= 0.1;
  }

  // Low stability triggers more instability (cascade)
  if (country.stability < 30) {
    stabilityDelta -= 0.2;
  }

  // Natural recovery toward 50 (mean reversion)
  if (country.stability > 60 && stabilityDelta >= 0) {
    stabilityDelta += 0.05;
  }

  return {
    stabilityDelta,
    approvalDelta,
    revolutionRisk: calculateRevolutionRisk(country),
  };
}

/** Calculate risk of revolution (0-1) */
export function calculateRevolutionRisk(country: CountryState): number {
  if (country.stability > 40 && country.approval > 30) return 0;

  const stabilityFactor = Math.max(0, (40 - country.stability) / 40);
  const approvalFactor = Math.max(0, (30 - country.approval) / 30);

  return Math.min(1, stabilityFactor * 0.6 + approvalFactor * 0.4);
}

export interface StabilityDelta {
  stabilityDelta: number;
  approvalDelta: number;
  revolutionRisk: number;
}
