import type { PlayerAction } from '@conflict-game/shared-types';

export interface QueuedAction {
  playerId: string;
  countryCode: string;
  sessionId: string;
  action: PlayerAction;
  timestamp: number;
}

/** Per-session action queue. Actions are queued by WS handler and drained by game loop each tick. */
const queues = new Map<string, QueuedAction[]>();

/**
 * How many actions one player may have pending for a single tick. Without a
 * cap a client can enqueue thousands per tick and both outpace honest players
 * and stall the loop — the AI has always been capped, humans were not.
 */
export const MAX_ACTIONS_PER_PLAYER_PER_TICK = 12;

/** Queue an action. Returns false when the player is over their tick budget. */
export function enqueueAction(sessionId: string, item: Omit<QueuedAction, 'timestamp'>): boolean {
  if (!queues.has(sessionId)) queues.set(sessionId, []);
  const q = queues.get(sessionId)!;
  const mine = q.reduce((n, a) => (a.playerId === item.playerId ? n + 1 : n), 0);
  if (mine >= MAX_ACTIONS_PER_PLAYER_PER_TICK) return false;
  q.push({ ...item, timestamp: Date.now() });
  return true;
}

export function drainActions(sessionId: string): QueuedAction[] {
  const q = queues.get(sessionId) || [];
  queues.set(sessionId, []);
  return q;
}

export function clearSessionQueue(sessionId: string): void {
  queues.delete(sessionId);
}

