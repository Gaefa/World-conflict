'use client';

import { create } from 'zustand';
import type { GameState, GameStateDelta, PlayerAction, ActionResult } from '@conflict-game/shared-types';
import { playTick, playActionSuccess, playActionFailed, playEventSound } from '@/lib/sounds';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002/ws';

interface GameStore {
  // Connection
  sessionId: string | null;
  playerId: string | null;
  ws: WebSocket | null;
  connected: boolean;

  // Game state (from server)
  gameState: GameState | null;
  currentTick: number;
  tensionIndex: number;

  // UI state
  selectedCountryCode: string | null;
  isPaused: boolean;
  lastActionResult: ActionResult | null;

  // Actions
  createSession: (name: string, playerName: string, options?: { allowAI?: boolean; aiDifficulty?: string }) => Promise<void>;
  joinSession: (sessionId: string, playerName: string) => Promise<void>;
  selectCountry: (countryCode: string) => Promise<void>;
  startGame: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  setSelectedCountry: (code: string | null) => void;
  sendAction: (action: PlayerAction) => void;
  togglePause: () => void;
  applyDelta: (delta: GameStateDelta) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  sessionId: null,
  playerId: null,
  ws: null,
  connected: false,
  gameState: null,
  currentTick: 0,
  tensionIndex: 0,
  selectedCountryCode: null,
  isPaused: false,
  lastActionResult: null,

  createSession: async (name: string, playerName: string, options?: { allowAI?: boolean; aiDifficulty?: string }) => {
    const res = await fetch(`${API_URL}/api/game/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, playerName, maxPlayers: 30, ...options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    set({ sessionId: data.session.id, playerId: data.player.id });
  },

  joinSession: async (sessionId: string, playerName: string) => {
    const res = await fetch(`${API_URL}/api/game/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    set({ sessionId, playerId: data.player.id });
  },

  selectCountry: async (countryCode: string) => {
    const { sessionId, playerId } = get();
    if (!sessionId || !playerId) return;
    const res = await fetch(`${API_URL}/api/game/sessions/${sessionId}/select-country`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, countryCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    set({ selectedCountryCode: countryCode });
  },

  startGame: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const res = await fetch(`${API_URL}/api/game/sessions/${sessionId}/start`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Fetch full state
    const stateRes = await fetch(`${API_URL}/api/game/state/${sessionId}`);
    const stateData = await stateRes.json();
    set({ gameState: stateData.state, currentTick: 0 });

    // Connect WS
    get().connectWebSocket();
  },

  connectWebSocket: () => {
    const { sessionId, playerId } = get();
    if (!sessionId || !playerId) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      set({ connected: true });
      ws.send(JSON.stringify({
        type: 'join_session',
        payload: { sessionId, playerId },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'state_delta':
            get().applyDelta(msg.payload);
            break;
          case 'action_result':
            set({ lastActionResult: msg.payload });
            if (msg.payload.success) {
              playActionSuccess();
            } else {
              playActionFailed();
              console.warn(`Action failed: ${msg.payload.message}`);
            }
            break;
          case 'session_status':
            if (msg.payload.status === 'paused') set({ isPaused: true });
            if (msg.payload.status === 'resumed') set({ isPaused: false });
            break;
          case 'game_event':
            // Append event to game state
            const { gameState: gs } = get();
            if (gs) {
              set({
                gameState: {
                  ...gs,
                  events: [...gs.events, msg.payload].slice(-100),
                },
              });
            }
            break;
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      set({ connected: false, ws: null });
    };

    set({ ws });
  },

  disconnectWebSocket: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, connected: false });
    }
  },

  setSelectedCountry: (code: string | null) => {
    set({ selectedCountryCode: code });
  },

  sendAction: (action: PlayerAction) => {
    const { ws, connected } = get();
    if (!ws || !connected) {
      console.warn('Cannot send action: not connected');
      return;
    }
    ws.send(JSON.stringify({ type: 'player_action', payload: action }));
  },

  togglePause: () => {
    const { ws, connected } = get();
    if (!ws || !connected) return;
    ws.send(JSON.stringify({ type: 'toggle_pause' }));
  },

  applyDelta: (delta: GameStateDelta) => {
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
