import type { CountryState } from '@conflict-game/shared-types';

const WEIGHTS = {
  gdp: 0.25,
  military: 0.25,
  diplomacy: 0.20,
  technology: 0.15,
  stability: 0.15,
};

/** Calculate Index of Power for a country (0-100 scale) */
export function calculateIndexOfPower(country: CountryState): number {
  // Normalize GDP to 0-100 (rough: $20T max → 100)
  const gdpScore = Math.min(100, (country.economy.gdp / 20_000) * 100);

  // Military score from forces
  const militaryScore = Math.min(100, (
    country.military.army / 10_000 +
    country.military.navy / 100 +
    country.military.airForce / 500 +
    country.military.nuclearWeapons * 5
  ));

  const diplomacyScore = country.diplomaticInfluence;
  const techScore = (country.techLevel / 10) * 100;
  const stabilityScore = country.stability;

  return (
    gdpScore * WEIGHTS.gdp +
    militaryScore * WEIGHTS.military +
    diplomacyScore * WEIGHTS.diplomacy +
    techScore * WEIGHTS.technology +
    stabilityScore * WEIGHTS.stability
  );
}
