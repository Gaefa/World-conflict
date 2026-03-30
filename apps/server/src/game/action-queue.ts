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

export function enqueueAction(sessionId: string, item: Omit<QueuedAction, 'timestamp'>): void {
  if (!queues.has(sessionId)) queues.set(sessionId, []);
  queues.get(sessionId)!.push({ ...item, timestamp: Date.now() });
}

export function drainActions(sessionId: string): QueuedAction[] {
  const q = queues.get(sessionId) || [];
  queues.set(sessionId, []);
  return q;
}

export function clearQueue(sessionId: string): void {
  queues.delete(sessionId);
}
