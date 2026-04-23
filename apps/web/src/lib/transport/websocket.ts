import type { GameState, PlayerAction } from '@conflict-game/shared-types';
import type { GameTransport, SessionOptions, TransportHandlers } from './types';

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002/ws';

export interface WebSocketTransportOptions {
  /** Override the REST base URL. Defaults to NEXT_PUBLIC_API_URL. */
  apiUrl?: string;
  /** Override the WebSocket URL. Defaults to NEXT_PUBLIC_WS_URL. */
  wsUrl?: string;
}

/**
 * Derive a ws:// URL from an http:// base URL when the caller only gave us
 * one. This keeps the host-entry UX simple: user types `http://192.168.1.42:3002`
 * and both REST and WS endpoints are inferred.
 */
function deriveWsUrl(apiUrl: string): string {
  try {
    const u = new URL(apiUrl);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    // Strip any path the caller accidentally included, then append /ws.
    u.pathname = '/ws';
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return DEFAULT_WS_URL;
  }
}

/**
 * Multiplayer transport: REST for lobby, WebSocket for live game.
 *
 * In LAN-host mode the embedded desktop server is reachable at
 * `http://<host-lan-ip>:3002`; pass that into the constructor and both the
 * REST calls and the WS connection will target it. With no options, falls
 * back to NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL env vars.
 */
export class WebSocketTransport implements GameTransport {
  private ws: WebSocket | null = null;
  private readonly apiUrl: string;
  private readonly wsUrl: string;

  constructor(options: WebSocketTransportOptions = {}) {
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL;
    // If only apiUrl was supplied, derive a matching ws URL from it so
    // the UI doesn't have to ask the user to enter two URLs.
    this.wsUrl = options.wsUrl ?? (options.apiUrl ? deriveWsUrl(options.apiUrl) : DEFAULT_WS_URL);
  }

  async createSession(name: string, playerName: string, options?: SessionOptions) {
    const res = await fetch(`${this.apiUrl}/api/game/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, playerName, maxPlayers: 30, ...options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return { sessionId: data.session.id, playerId: data.player.id };
  }

  async joinSession(sessionId: string, playerName: string) {
    const res = await fetch(`${this.apiUrl}/api/game/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return { playerId: data.player.id };
  }

  async selectCountry(sessionId: string, playerId: string, countryCode: string) {
    const res = await fetch(`${this.apiUrl}/api/game/sessions/${sessionId}/select-country`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, countryCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
  }

  async startGame(sessionId: string, _playerId: string): Promise<GameState> {
    const res = await fetch(`${this.apiUrl}/api/game/sessions/${sessionId}/start`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const stateRes = await fetch(`${this.apiUrl}/api/game/state/${sessionId}`);
    const stateData = await stateRes.json();
    return stateData.state as GameState;
  }

  connect(sessionId: string, playerId: string, handlers: TransportHandlers) {
    const ws = new WebSocket(this.wsUrl);

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
