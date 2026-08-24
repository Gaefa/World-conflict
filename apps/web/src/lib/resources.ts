import type { CountryState, ResourceType } from '@conflict-game/shared-types';

/**
 * Resource pickers shared by the action panel and the console tabs.
 * They were copy-pasted in three places, so a balance tweak meant three
 * edits — and three chances to forget one.
 */

/** Resource with the biggest surplus (production − consumption) — what to offer in trade. */
export function surplusResource(country: CountryState): ResourceType {
  const rs = country.resourceState ?? {};
  let best: ResourceType = 'oil';
  let bestVal = -Infinity;
  for (const [r, b] of Object.entries(rs)) {
    if (!b) continue;
    const surplus = b.production - b.consumption;
    if (surplus > bestVal) { bestVal = surplus; best = r as ResourceType; }
  }
  return best;
}

/** Resource with the biggest deficit — what to stockpile first. */
export function deficitResource(country: CountryState): ResourceType {
  const rs = country.resourceState ?? {};
  let best: ResourceType = 'oil';
  let bestVal = 0;
  for (const [r, b] of Object.entries(rs)) {
    if (b && b.deficit > bestVal) { bestVal = b.deficit; best = r as ResourceType; }
  }
  return best;
}

/** Highest-production resource plus its output — the one worth squeezing the market with. */
export function topProductionResource(country: CountryState): { resource: ResourceType; production: number } {
  const rs = country.resourceState ?? {};
  let best: ResourceType = 'oil';
  let bestVal = 0;
  for (const [r, b] of Object.entries(rs)) {
    if (b && b.production > bestVal) { bestVal = b.production; best = r as ResourceType; }
  }
  return { resource: best, production: bestVal };
}
