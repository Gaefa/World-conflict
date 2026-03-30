import type { CountryState, CountryEconomy } from '@conflict-game/shared-types';

/** Process one economic tick for a country */
export function processEconomyTick(country: CountryState): Partial<CountryEconomy> {
  const { economy, resources, stability } = country;

  // GDP growth affected by stability and trade
  const stabilityFactor = stability / 100; // 0-1
  const growthRate = economy.gdpGrowth / 100 / (365 * 24 * 6); // per-tick growth (10s ticks)
  const newGdp = economy.gdp * (1 + growthRate * stabilityFactor);

  // Tax revenue
  const taxRevenue = newGdp * economy.taxRate * 0.001; // per-tick revenue

  // Budget update
  const newBudget = economy.budget + taxRevenue;

  // Inflation affected by budget deficit
  const inflationDelta = economy.debtToGdp > 1 ? 0.001 : -0.0001;

  return {
    gdp: newGdp,
    budget: newBudget,
    inflation: Math.max(0, economy.inflation + inflationDelta),
  };
}

/** Calculate trade income between two countries */
export function calculateTradeIncome(
  exporter: CountryState,
  importer: CountryState,
  resourceType: string,
  amount: number
): number {
  // Simple: trade income = amount * resource value * tech multiplier
  const techMultiplier = 1 + (exporter.techLevel - 1) * 0.1;
  const resourceValues: Record<string, number> = {
    oil: 80, gas: 50, metals: 40, rareEarth: 120, food: 20, water: 10,
  };
  const value = resourceValues[resourceType] ?? 30;
  return amount * value * techMultiplier;
}
