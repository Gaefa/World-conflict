import type { PlayerAction, ActionResult } from './actions';
import type { GameState, GameStateDelta, Player } from './game';
import type { GameEvent } from './events';

/** Messages from client to server */
export type ClientMessage =
  | { type: 'player_action'; payload: PlayerAction }
  | { type: 'join_session'; payload: { sessionId: string; playerId: string; token: string } }
  | { type: 'leave_session' }
  | { type: 'chat_message'; payload: { text: string; channel: 'global' | 'alliance' } }
  | { type: 'ready'; payload: { ready: boolean } }
  | { type: 'toggle_pause' }
  | { type: 'ping' };

/** Multiplayer pauses: each player gets a few, and each ends by itself. */
export const PAUSES_PER_PLAYER = 2;
export const PAUSE_MAX_MS = 60_000;

/** Messages from server to client */
export type ServerMessage =
  | { type: 'game_state'; payload: GameState }
  | { type: 'state_delta'; payload: GameStateDelta }
  | { type: 'action_result'; payload: ActionResult }
  | { type: 'game_event'; payload: GameEvent }
  | { type: 'player_update'; payload: Player }
  | { type: 'chat_message'; payload: { from: string; text: string; channel: string; timestamp: string } }
  | { type: 'session_status'; payload: { status: string; message: string; /** who paused */ playerId?: string } }
  | { type: 'error'; payload: { code: string; message: string } }
  | { type: 'pong' };
