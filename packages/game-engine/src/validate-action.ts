import type { PlayerAction } from '@conflict-game/shared-types';

/**
 * Structural validation of an incoming action — the server's first line of
 * defence in ranked multiplayer.
 *
 * The per-action processors already enforce *game* rules (can you afford it,
 * do you have the fleet, is the tech researched). What they trusted was the
 * *shape* of the numbers, and that trust was exploitable: `create_army` with
 * a negative size produced a negative recruitment cost, so subtracting it
 * ADDED money. This layer rejects such actions before any processor runs.
 *
 * Returns null when the action is acceptable, or a reason string to reject.
 */
export function validateAction(action: PlayerAction): string | null {
  // Every numeric field must be a real, finite number. Blocks NaN/Infinity
  // injected through the wire, which would poison whatever it touches.
  for (const [key, value] of Object.entries(action as unknown as Record<string, unknown>)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return `Field "${key}" must be a finite number`;
    }
  }

  const between = (v: number, min: number, max: number, name: string) =>
    v >= min && v <= max ? null : `${name} must be between ${min} and ${max}`;

  switch (action.type) {
    case 'create_army':
      return between(action.size, 1, 1_000_000, 'Army size')
        ?? between(action.latitude, -90, 90, 'Latitude')
        ?? between(action.longitude, -180, 180, 'Longitude');

    case 'move_army':
      return between(action.targetLat, -90, 90, 'Target latitude')
        ?? between(action.targetLng, -180, 180, 'Target longitude');

    case 'invasion':
      return between(action.committedForces, 0.01, 1, 'Committed forces');

    case 'allocate_budget':
      return between(action.amount, 0.01, 100_000, 'Budget amount');

    case 'set_tax_rate':
      return between(action.rate, 0, 1, 'Tax rate');

    case 'arms_deal':
      return between(action.amount, 1, 20, 'Arms deal amount');

    case 'boost_counter_intel':
      return between(action.amount, 1, 20, 'Counter-intel investment');

    case 'set_intel_budget':
      return between(action.budget, 0, 1_000, 'Intel budget');

    case 'build_stockpile':
      return between(action.months, 1, 12, 'Stockpile months');

    case 'proxy_war':
      return between(action.funding, 1, 1_000, 'Proxy war funding');

    case 'smuggle':
      return between(action.amount, 1, 10_000, 'Smuggle amount');

    case 'launch_disinfo':
      return between(action.multiplier, 0.1, 10, 'Disinfo multiplier')
        ?? between(action.duration, 1, 60, 'Disinfo duration');

    case 'propose_trade':
    case 'counter_trade': {
      const items = [...(action.offers ?? []), ...(action.requests ?? [])];
      for (const item of items) {
        const bad = between(item.amount, 0.01, 10_000, 'Trade amount');
        if (bad) return bad;
        if (item.priceModifier !== undefined) {
          const badPrice = between(item.priceModifier, 0.1, 10, 'Price modifier');
          if (badPrice) return badPrice;
        }
      }
      if ('duration' in action && action.duration !== undefined) {
        return between(action.duration, 1, 120, 'Trade duration');
      }
      return null;
    }

    default:
      return null;
  }
}
