import type {
  GameState,
  GameStateDelta,
  ActionResult,
  GameEvent,
  PlayerAction,
} from '@conflict-game/shared-types';

/**
 * Everything the store cares about from "the network."
 * Both WebSocket (multiplayer) and in-process (singleplayer) transports implement this.
 */

export interface SessionOptions {
  allowAI?: boolean;
  aiDifficulty?: string;
}

export interface TransportHandlers {
  onStateDelta(delta: GameStateDelta): void;
  onActionResult(result: ActionResult): void;
  onSessionStatus(status: { status: string; message?: string }): void;
  onGameEvent(event: GameEvent): void;
  onConnected?(): void;
  onDisconnected?(): void;
}

export interface GameTransport {
  // Lobby lifecycle (pre-game)
  createSession(name: string, playerName: string, options?: SessionOptions): Promise<{ sessionId: string; playerId: string }>;
  joinSession(sessionId: string, playerName: string): Promise<{ playerId: string }>;
  selectCountry(sessionId: string, playerId: string, countryCode: string): Promise<void>;
  /** Starts the session on the server/engine and returns the initial full state. */
  startGame(sessionId: string, playerId: string): Promise<GameState>;

  // Live connection (once the game is running)
  connect(sessionId: string, playerId: string, handlers: TransportHandlers): void;
  disconnect(): void;

  // Runtime actions
  sendAction(action: PlayerAction): void;
  togglePause(): void;
}
