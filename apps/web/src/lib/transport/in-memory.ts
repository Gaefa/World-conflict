import type {
  GameState,
  GameSettings,
  CountryState,
  IntelligenceState,
  TechnologyState,
  ServerMessage,
  PlayerAction,
} from '@conflict-game/shared-types';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import {
  calculateIndexOfPower,
  PROCESSING_CHAINS,
  getStartingTechs,
  computeTechBonuses,
} from '@conflict-game/game-logic';
import {
  GameLoop,
  InMemoryGameStateStore,
  enqueueAction,
  createAIState,
  type GameLoopAdapter,
  type AIState,
} from '@conflict-game/game-engine';
import type { GameTransport, SessionOptions, TransportHandlers } from './types';

/** Minimal session/player records — singleplayer never has more than one of each. */
interface LocalSession {
  id: string;
  name: string;
  hostPlayerId: string;
  settings: GameSettings;
  status: 'lobby' | 'active' | 'paused' | 'finished';
  createdAt: Date;
}
interface LocalPlayer {
  id: string;
  sessionId: string;
  name: string;
  countryCode: string | null;
}

const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 1,
  tickIntervalMs: 10_000,
  sessionDurationTicks: 360,
  speed: 1,
  allowAI: true,
  aiDifficulty: 'normal',
  victoryConditions: ['domination', 'economic_hegemony', 'diplomatic', 'technological', 'survival'],
};

function defaultIntel(): IntelligenceState {
  return { intelBudget: 0, counterIntel: 20, disinfo: [], sigintActive: false, dossiers: {} };
}
function defaultTech(techLevel: number): TechnologyState {
  const researchedTechs = getStartingTechs(techLevel);
  return {
    researchedTechs,
    activeResearch: null,
    bonuses: computeTechBonuses(researchedTechs),
  };
}
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

/**
 * Singleplayer transport: runs the full game engine in-process inside the browser.
 * Same surface as WebSocketTransport — gameStore cannot tell which is wired up.
 */
export class InMemoryTransport implements GameTransport {
  private store = new InMemoryGameStateStore();
  private aiStates = new Map<string, Map<string, AIState>>();
  private session: LocalSession | null = null;
  private player: LocalPlayer | null = null;
  private handlers: TransportHandlers | null = null;
  private gameLoop: GameLoop;

  constructor() {
    const adapter: GameLoopAdapter = {
      sendToPlayer: (playerId, message) => this.dispatch(playerId, message),
      broadcast: (_sessionId, message) => {
        // Singleplayer: only one player, so broadcast == sendToPlayer.
        if (this.player) this.dispatch(this.player.id, message);
      },
      getPlayerConnections: (sessionId) => {
        if (!this.player || this.player.sessionId !== sessionId) return [];
        return [{ playerId: this.player.id, countryCode: this.player.countryCode }];
      },
    };
    this.gameLoop = new GameLoop(this.store, adapter);
    this.gameLoop.setAIStates(this.aiStates);
  }

  private dispatch(playerId: string, message: ServerMessage): void {
    if (!this.handlers || !this.player || this.player.id !== playerId) return;
    switch (message.type) {
      case 'state_delta':    this.handlers.onStateDelta(message.payload); break;
      case 'action_result':  this.handlers.onActionResult(message.payload); break;
      case 'session_status': this.handlers.onSessionStatus(message.payload); break;
      case 'game_event':     this.handlers.onGameEvent(message.payload); break;
    }
  }

  async createSession(name: string, playerName: string, options?: SessionOptions) {
    const sessionId = uuid();
    const playerId = uuid();
    const settings: GameSettings = {
      ...DEFAULT_SETTINGS,
      allowAI: options?.allowAI ?? DEFAULT_SETTINGS.allowAI,
      aiDifficulty: (options?.aiDifficulty as GameSettings['aiDifficulty']) ?? DEFAULT_SETTINGS.aiDifficulty,
    };
    this.session = {
      id: sessionId,
      name,
      hostPlayerId: playerId,
      settings,
      status: 'lobby',
      createdAt: new Date(),
    };
    this.player = { id: playerId, sessionId, name: playerName, countryCode: null };
    return { sessionId, playerId };
  }

  async joinSession(_sessionId: string, _playerName: string): Promise<{ playerId: string }> {
    throw new Error('Singleplayer does not support joining remote sessions');
  }

  async selectCountry(sessionId: string, playerId: string, countryCode: string) {
    if (!this.session || this.session.id !== sessionId) throw new Error('Unknown session');
    if (!this.player || this.player.id !== playerId) throw new Error('Unknown player');
    if (!SEED_COUNTRIES.find(c => c.code === countryCode)) throw new Error('Invalid country code');
    this.player.countryCode = countryCode;
  }

  async startGame(sessionId: string, _playerId: string): Promise<GameState> {
    if (!this.session || this.session.id !== sessionId) throw new Error('Unknown session');
    if (!this.player?.countryCode) throw new Error('Select a country before starting');

    // Initialize ALL seed countries — matches server's game-mem.ts behavior so
    // diplomacy / trade / war work with any country from day one.
    const countries: Record<string, CountryState> = {};
    for (const seedCountry of SEED_COUNTRIES) {
      const state: CountryState = {
        ...seedCountry.startingState,
        intel: defaultIntel(),
        tech: defaultTech(seedCountry.startingState.techLevel),
      };
      state.indexOfPower = calculateIndexOfPower(state);
      countries[seedCountry.code] = state;
    }

    const now = new Date().toISOString();
    const gameState: GameState = {
      session: {
        id: sessionId,
        name: this.session.name,
        hostPlayerId: this.session.hostPlayerId,
        status: 'active',
        settings: this.session.settings,
        currentTick: 0,
        createdAt: this.session.createdAt.toISOString(),
        startedAt: now,
        finishedAt: null,
      },
      players: [{
        id: this.player.id,
        userId: this.player.id,
        username: this.player.name,
        sessionId,
        countryCode: this.player.countryCode,
        isAI: false,
        isReady: true,
        isOnline: true,
        joinedAt: now,
      }],
      countries,
      armies: [],
      relations: [],
      events: [],
      tensionIndex: 20,
      resourceMarket: { prices: {}, globalSupply: {}, globalDemand: {} },
      processingChains: PROCESSING_CHAINS,
    };

    this.store.setState(sessionId, gameState);

    // Seed AI states for all non-player countries.
    const sessionAI = new Map<string, AIState>();
    if (this.session.settings.allowAI !== false) {
      const diff = this.session.settings.aiDifficulty ?? 'normal';
      for (const [code, country] of Object.entries(countries)) {
        if (code !== this.player.countryCode) {
          sessionAI.set(code, createAIState(code, country, diff));
        }
      }
    }
    this.aiStates.set(sessionId, sessionAI);

    this.session.status = 'active';
    return gameState;
  }

  connect(sessionId: string, playerId: string, handlers: TransportHandlers): void {
    if (!this.session || this.session.id !== sessionId) throw new Error('Unknown session');
    if (!this.player || this.player.id !== playerId) throw new Error('Unknown player');
    this.handlers = handlers;
    // Fire onConnected synchronously to match WS transport semantics (sort of).
    handlers.onConnected?.();
    this.gameLoop.start(sessionId);
  }

  disconnect(): void {
    if (this.session) this.gameLoop.stop(this.session.id);
    this.handlers?.onDisconnected?.();
    this.handlers = null;
  }

  sendAction(action: PlayerAction): void {
    if (!this.session || !this.player?.countryCode) return;
    enqueueAction(this.session.id, {
      playerId: this.player.id,
      countryCode: this.player.countryCode,
      sessionId: this.session.id,
      action,
    });
  }

  togglePause(): void {
    if (!this.session) return;
    const sid = this.session.id;
    if (this.gameLoop.isPaused(sid)) {
      this.gameLoop.resume(sid);
      this.handlers?.onSessionStatus({ status: 'resumed' });
    } else {
      this.gameLoop.pause(sid);
      this.handlers?.onSessionStatus({ status: 'paused' });
    }
  }

  // ─── Save / load support ──────────────────────────────────────────────────

  /**
   * Capture a JSON-safe snapshot of the current engine state. Returns null
   * if there is no active session (nothing to save).
   */
  captureSnapshot(): {
    gameState: import('@conflict-game/shared-types').GameState;
    aiStates: Record<string, AIState>;
    playerCountryCode: string;
    playerId: string;
  } | null {
    if (!this.session || !this.player?.countryCode) return null;
    const gs = this.store.getState(this.session.id);
    if (!gs) return null;
    const sessionAI = this.aiStates.get(this.session.id);
    const aiStates: Record<string, AIState> = sessionAI
      ? Object.fromEntries(sessionAI.entries())
      : {};
    // Deep-clone via JSON so callers always get an independent copy.
    return {
      gameState: JSON.parse(JSON.stringify(gs)),
      aiStates: JSON.parse(JSON.stringify(aiStates)),
      playerCountryCode: this.player.countryCode,
      playerId: this.player.id,
    };
  }

  /**
   * Restore engine state from a previously captured snapshot, then start
   * ticking. Returns the restored `GameState` so `gameStore` can populate
   * its own state without an extra round-trip.
   *
   * This does NOT call `handlers.onConnected` — the store must call
   * `connectToGame()` after calling this.
   */
  restoreFromSave(
    gameState: import('@conflict-game/shared-types').GameState,
    aiStates: Record<string, AIState>,
    playerCountryCode: string,
    playerId: string,
  ): import('@conflict-game/shared-types').GameState {
    const sessionId = gameState.session.id;
    const sessionName = gameState.session.name;

    // Rebuild LocalSession + LocalPlayer records.
    this.session = {
      id: sessionId,
      name: sessionName,
      hostPlayerId: gameState.session.hostPlayerId,
      settings: gameState.session.settings,
      status: 'active',
      createdAt: new Date(gameState.session.createdAt),
    };
    this.player = {
      id: playerId,
      sessionId,
      name:
        gameState.players.find(p => p.id === playerId)?.username ?? playerCountryCode,
      countryCode: playerCountryCode,
    };

    // Re-hydrate the engine store.
    const restoredState: import('@conflict-game/shared-types').GameState = {
      ...JSON.parse(JSON.stringify(gameState)),
      session: { ...gameState.session, status: 'active' },
    };
    this.store.setState(sessionId, restoredState);

    // Re-hydrate AI states.
    const sessionAI = new Map<string, AIState>(Object.entries(aiStates));
    this.aiStates.set(sessionId, sessionAI);

    return restoredState;
  }
}
