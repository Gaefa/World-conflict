import type {
  PlayerAction,
  ActionResult,
  GameState,
  DiplomaticRelation,
} from '@conflict-game/shared-types';

export function makeDipRelation(
  state: GameState,
  type: DiplomaticRelation['type'],
  fromCode: string,
  targetCode: string,
): DiplomaticRelation {
  return {
    id: `rel-${type}-${fromCode}-${targetCode}-${Date.now()}`,
    sessionId: state.session.id,
    fromCountry: fromCode,
    toCountry: targetCode,
    type,
    status: 'active',
    createdAtTick: state.session.currentTick,
    expiresAtTick: null,
  };
}

export function addEvent(
  state: GameState,
  type: string,
  title: string,
  description: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  involved: string[],
) {
  state.events.push({
    id: `evt-${type}-${involved.join('-')}-${state.session.currentTick}`,
    sessionId: state.session.id,
    type: type as any,
    title,
    description,
    severity,
    involvedCountries: involved,
    tick: state.session.currentTick,
    data: {},
    createdAt: new Date().toISOString(),
  });
}

export function isAtWar(state: GameState, c1: string, c2: string): boolean {
  return state.relations.some(
    r => r.type === 'war' && r.status === 'active' &&
    ((r.fromCountry === c1 && r.toCountry === c2) || (r.fromCountry === c2 && r.toCountry === c1))
  );
}

export function fail(action: PlayerAction, message: string): ActionResult {
  return { success: false, action, message, effects: [] };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** GDP of a "reference" country ($1T). Costs scale relative to this. */
const REFERENCE_GDP = 1000;

/**
 * Scale a flat base cost (in $B) proportionally to the acting country's GDP.
 * Uses sqrt so the curve is gentle: a country 4× richer pays 2× more, not 4×.
 * Example: base $2B surgical airstrike →
 *   USA  ($25T): $10B  |  Russia ($2.2T): $3B  |  Ukraine ($160B): $0.8B
 */
export function scaledCost(baseCost: number, gdp: number): number {
  const factor = Math.sqrt(Math.max(0.001, gdp) / REFERENCE_GDP);
  return Math.max(0.1, Math.round(baseCost * factor * 10) / 10);
}
