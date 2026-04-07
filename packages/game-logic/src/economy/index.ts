import type { CountryState, CountryEconomy } from '@conflict-game/shared-types';

/** Process one economic tick for a country. 1 tick = 1 month. */
export function processEconomyTick(country: CountryState): Partial<CountryEconomy> {
  const { economy, stability } = country;

  // GDP growth affected by stability and resource shock
  const stabilityFactor = stability / 100; // 0-1
  const shockFactor = 1 / (economy.resourceShockMultiplier ?? 1); // deficit slows growth
  const growthRate = economy.gdpGrowth / 100 / 12; // annual % → per-month (1 tick = 1 month)
  const newGdp = economy.gdp * (1 + growthRate * stabilityFactor * shockFactor);

  // Tax revenue (per month): GDP is in $B, taxRate is 0-1, /12 for monthly
  // Only ~5% of total revenue goes to discretionary budget pool for player actions
  const taxRevenue = newGdp * economy.taxRate / 12 * 0.05; // $B per month

  // Budget update
  const newBudget = economy.budget + taxRevenue;

  // Inflation affected by budget deficit
  const inflationDelta = economy.debtToGdp > 1 ? 0.01 : -0.001;

  return {
    gdp: newGdp,
    budget: newBudget,
    inflation: Math.max(0, economy.inflation + inflationDelta),
  };
}

/** Resource base market prices ($/unit) */
export const RESOURCE_VALUES: Record<string, number> = {
  oil: 80, gas: 50, coal: 30,
  iron: 40, copper: 50, aluminum: 45, titanium: 80,
  gold: 120, silver: 60, palladium: 110, platinum: 130,
  diamonds: 150, gemstones: 100,
  rareEarth: 120, lithium: 100, cobalt: 90,
  uranium: 100,
  timber: 25, rareWood: 80,
  wheat: 20, rice: 25, fish: 35, freshWater: 10,
  steel: 50, electronics: 90, semiconductors: 200,
  refinedOil: 90, nuclearFuel: 150,
  luxuryGoods: 140, weaponsComponents: 160,
  pharmaceuticals: 120, fertilizer: 35,
};

/** Calculate trade income between two countries */
export function calculateTradeIncome(
  exporter: CountryState,
  _importer: CountryState,
  resourceType: string,
  amount: number,
): number {
  const techMultiplier = 1 + (exporter.techLevel - 1) * 0.1;
  const value = RESOURCE_VALUES[resourceType] ?? 30;
  return amount * value * techMultiplier;
}
