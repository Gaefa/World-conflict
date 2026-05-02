/** Mirrors the server-side scaledCost() in game-engine/src/actions/_helpers.ts */

const REFERENCE_GDP = 1000; // $1T

/**
 * Scale a flat base cost (in $B) by the acting country's GDP.
 * sqrt curve: 4× richer country pays 2× more, not 4×.
 */
export function scaledCost(baseCost: number, gdp: number): number {
  const factor = Math.sqrt(Math.max(0.001, gdp) / REFERENCE_GDP);
  return Math.max(0.1, Math.round(baseCost * factor * 10) / 10);
}

/** Format a scaled cost as a human-readable label, e.g. "$3B" or "$0.8B" */
export function costLabel(baseCost: number, gdp: number): string {
  const c = scaledCost(baseCost, gdp);
  return `$${c % 1 === 0 ? c.toFixed(0) : c.toFixed(1)}B`;
}
