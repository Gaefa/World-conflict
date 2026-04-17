import type { GameState, PlayerAction } from '@conflict-game/shared-types';
import type { GameTransport, SessionOptions, TransportHandlers } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002/ws';

/**
 * Multiplayer transport: REST for lobby, WebSocket for live game.
 * Wraps the exact behaviour that used to live inline in gameStore.
 */
export class WebSocketTransport implements GameTransport {
  private ws: WebSocket | null = null;

  async createSession(name: string, playerName: string, options?: SessionOptions) {
    const res = await fetch(`${API_URL}/api/game/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, playerName, maxPlayers: 30, ...options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return { sessionId: data.session.id, playerId: data.player.id };
  }

  async joinSession(sessionId: string, playerName: string) {
    const res = await fetch(`${API_URL}/api/game/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return { playerId: data.player.id };
  }

  async selectCountry(sessionId: string, playerId: string, countryCode: string) {
    const res = await fetch(`${API_URL}/api/game/sessions/${sessionId}/select-country`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, countryCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
  }

  async startGame(sessionId: string, _playerId: string): Promise<GameState> {
    const res = await fetch(`${API_URL}/api/game/sessions/${sessionId}/start`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const stateRes = await fetch(`${API_URL}/api/game/state/${sessionId}`);
    const stateData = await stateRes.json();
    return stateData.state as GameState;
  }

  connect(sessionId: string, playerId: string, handlers: TransportHandlers) {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      handlers.onConnected?.();
      ws.send(JSON.stringify({ type: 'join_session', payload: { sessionId, playerId } }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'state_delta':    handlers.onStateDelta(msg.payload); break;
          case 'action_result':  handlers.onActionResult(msg.payload); break;
          case 'session_status': handlers.onSessionStatus(msg.payload); break;
          case 'game_event':     handlers.onGameEvent(msg.payload); break;
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      this.ws = null;
      handlers.onDisconnected?.();
    };

    this.ws = ws;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendAction(action: PlayerAction) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send action: not connected');
      return;
    }
    this.ws.send(JSON.stringify({ type: 'player_action', payload: action }));
  }

  togglePause() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'toggle_pause' }));
  }
}
