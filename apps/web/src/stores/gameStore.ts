'use client';

import { create } from 'zustand';
import type { GameState, GameStateDelta, PlayerAction, ActionResult } from '@conflict-game/shared-types';
import { playTick, playActionSuccess, playActionFailed, playEventSound } from '@/lib/sounds';
import { WebSocketTransport, InMemoryTransport, type GameTransport } from '@/lib/transport';
import { saveGame as idbSaveGame, loadGame as idbLoadGame, type SaveSnapshot } from '@/lib/save-store';

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

  // Tick timing (for countdown display)
  tickDurationMs: number;
  lastTickAt: number;

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
  /** True when the active transport is singleplayer and a game is running. */
  canSave: boolean;
  /** Persist current game state to a named IndexedDB slot. */
  saveGame: (slotName: string) => Promise<void>;
  /** Restore a previously saved slot and resume ticking. */
  loadGame: (snap: SaveSnapshot) => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  transport: new WebSocketTransport(),
  sessionId: null,
  playerId: null,
  connected: false,
  gameState: null,
  currentTick: 0,
  tensionIndex: 0,
  tickDurationMs: 10_000,
  lastTickAt: 0,
  selectedCountryCode: null,
  isPaused: false,
  lastActionResult: null,
  canSave: false,

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
    const canSave = transport instanceof InMemoryTransport;
    set({ gameState: initialState, currentTick: 0, canSave });
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

  saveGame: async (slotName) => {
    const { transport, gameState, currentTick } = get();
    if (!(transport instanceof InMemoryTransport)) return;
    const snap = transport.captureSnapshot();
    if (!snap) return;
    await idbSaveGame({
      name: slotName,
      timestamp: Date.now(),
      tick: currentTick,
      sessionName: gameState?.session.name ?? slotName,
      ...snap,
    });
  },

  loadGame: async (snap) => {
    const { transport: oldTransport } = get();
    // Cleanly disconnect any current session.
    oldTransport.disconnect();

    // Always load into a fresh InMemoryTransport.
    const transport = new InMemoryTransport();
    const restoredState = transport.restoreFromSave(
      snap.gameState,
      snap.aiStates,
      snap.playerCountryCode,
      snap.playerId,
    );
    set({
      transport,
      sessionId: restoredState.session.id,
      playerId: snap.playerId,
      gameState: restoredState,
      currentTick: restoredState.session.currentTick,
      tensionIndex: restoredState.tensionIndex,
      canSave: true,
      connected: false,
    });
    get().connectToGame();
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
      tickDurationMs: delta.tickDurationMs ?? get().tickDurationMs,
      lastTickAt: delta.tickEmittedAt ?? Date.now(),
    });
  },
}));
