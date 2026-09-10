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

/** What a player waiting in a multiplayer lobby sees. */
export interface LobbyView {
  code: string;
  status: string;
  hostPlayerId: string;
  players: { id: string; name: string; countryCode: string }[];
}

export interface TransportHandlers {
  onStateDelta(delta: GameStateDelta): void;
  onActionResult(result: ActionResult): void;
  /** `playerId` is set on "paused": who took the pause. */
  onSessionStatus(status: { status: string; message?: string; playerId?: string }): void;
  onGameEvent(event: GameEvent): void;
  onConnected?(): void;
  onDisconnected?(): void;
}

export interface GameTransport {
  // Lobby lifecycle (pre-game)
  createSession(name: string, playerName: string, options?: SessionOptions): Promise<{ sessionId: string; playerId: string }>;
  /** Enter someone else's lobby with their invite code. */
  joinSession(code: string, playerName: string): Promise<{ sessionId: string; playerId: string }>;
  /** Who is in the lobby and what they picked — polled while waiting. */
  getLobby(sessionId: string): Promise<LobbyView>;
  selectCountry(sessionId: string, playerId: string, countryCode: string): Promise<void>;
  /** Starts the session on the server/engine and returns the initial full state. */
  startGame(sessionId: string, playerId: string): Promise<GameState>;
  /** Initial state of a session someone else started (a guest following the host in). */
  fetchState(sessionId: string): Promise<GameState>;

  // Live connection (once the game is running)
  connect(sessionId: string, playerId: string, handlers: TransportHandlers): void;
  disconnect(): void;

  // Runtime actions
  sendAction(action: PlayerAction): void;
  togglePause(): void;
}
