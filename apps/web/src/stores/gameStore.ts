'use client';

import { create } from 'zustand';
import type { GameState, GameStateDelta, PlayerAction, ActionResult } from '@conflict-game/shared-types';
import { playTick, playActionSuccess, playActionFailed, playEventSound } from '@/lib/sounds';
import { WebSocketTransport, type GameTransport } from '@/lib/transport';

interface GameStore {
  // Connection
  transport: GameTransport;
  sessionId: string | null;
  playerId: string | null;
  connected: boolean;

  // Game state (from server/engine)
  gameState: GameState | null;
  currentTick: number;
  tensionIndex: number;

  // UI state
  selectedCountryCode: string | null;
  isPaused: boolean;
  lastActionResult: ActionResult | null;

  // Actions
  setTransport: (transport: GameTransport) => void;
  createSession: (name: string, playerName: string, options?: { allowAI?: boolean; aiDifficulty?: string }) => Promise<void>;
  joinSession: (sessionId: string, playerName: string) => Promise<void>;
  selectCountry: (countryCode: string) => Promise<void>;
  startGame: () => Promise<void>;
  connectToGame: () => void;
  disconnectFromGame: () => void;
  setSelectedCountry: (code: string | null) => void;
  sendAction: (action: PlayerAction) => void;
  togglePause: () => void;
  applyDelta: (delta: GameStateDelta) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  transport: new WebSocketTransport(),
  sessionId: null,
  playerId: null,
  connected: false,
  gameState: null,
  currentTick: 0,
  tensionIndex: 0,
  selectedCountryCode: null,
  isPaused: false,
  lastActionResult: null,

  setTransport: (transport) => {
    // Swap transports — used when switching between multiplayer and singleplayer.
    // Caller is expected to not have an active connection on the old transport.
    set({ transport });
  },

  createSession: async (name, playerName, options) => {
    const { transport } = get();
    const { sessionId, playerId } = await transport.createSession(name, playerName, options);
    set({ sessionId, playerId });
  },

  joinSession: async (sessionId, playerName) => {
    const { transport } = get();
    const { playerId } = await transport.joinSession(sessionId, playerName);
    set({ sessionId, playerId });
  },

  selectCountry: async (countryCode) => {
    const { transport, sessionId, playerId } = get();
    if (!sessionId || !playerId) return;
    await transport.selectCountry(sessionId, playerId, countryCode);
    set({ selectedCountryCode: countryCode });
  },

  startGame: async () => {
    const { transport, sessionId, playerId } = get();
    if (!sessionId || !playerId) return;
    const initialState = await transport.startGame(sessionId, playerId);
    set({ gameState: initialState, currentTick: 0 });
    get().connectToGame();
  },

  connectToGame: () => {
    const { transport, sessionId, playerId } = get();
    if (!sessionId || !playerId) return;

    transport.connect(sessionId, playerId, {
      onConnected: () => set({ connected: true }),
      onDisconnected: () => set({ connected: false }),
      onStateDelta: (delta) => get().applyDelta(delta),
      onActionResult: (result) => {
        set({ lastActionResult: result });
        if (result.success) {
          playActionSuccess();
        } else {
          playActionFailed();
          console.warn(`Action failed: ${result.message}`);
        }
      },
      onSessionStatus: (status) => {
        if (status.status === 'paused') set({ isPaused: true });
        if (status.status === 'resumed') set({ isPaused: false });
      },
      onGameEvent: (event) => {
        const { gameState: gs } = get();
        if (gs) {
          set({ gameState: { ...gs, events: [...gs.events, event].slice(-100) } });
        }
      },
    });
  },

  disconnectFromGame: () => {
    get().transport.disconnect();
    set({ connected: false });
  },

  setSelectedCountry: (code) => {
    set({ selectedCountryCode: code });
  },

  sendAction: (action) => {
    get().transport.sendAction(action);
  },

  togglePause: () => {
    get().transport.togglePause();
  },

  applyDelta: (delta) => {
    const { gameState } = get();
    if (!gameState) return;

    const newState = { ...gameState };
    newState.session = { ...newState.session, currentTick: delta.tick };

    // Apply country deltas
    if (delta.countries) {
      const newCountries = { ...newState.countries };
      for (const [code, changes] of Object.entries(delta.countries)) {
        if (changes && newCountries[code]) {
          newCountries[code] = {
            ...newCountries[code],
            ...changes,
            economy: changes.economy
              ? { ...newCountries[code].economy, ...changes.economy }
              : newCountries[code].economy,
          };
        }
      }
      newState.countries = newCountries;
    }

    // Update relations
    if (delta.relations) {
      newState.relations = delta.relations;
    }

    // Append events
    if (delta.events) {
      newState.events = [...newState.events, ...delta.events].slice(-100);
      // Play sound for notable events
      for (const evt of delta.events) {
        playEventSound(evt.type, evt.severity);
      }
    }

    // Tick sound (subtle)
    playTick();

    if (delta.tensionIndex !== undefined) {
      newState.tensionIndex = delta.tensionIndex;
    }

    set({
      gameState: newState,
      currentTick: delta.tick,
      tensionIndex: delta.tensionIndex ?? get().tensionIndex,
    });
  },
}));
