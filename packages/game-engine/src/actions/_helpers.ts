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
