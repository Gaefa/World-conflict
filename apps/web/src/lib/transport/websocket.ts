import type { GameState, PlayerAction } from '@conflict-game/shared-types';
import type { GameTransport, LobbyView, SessionOptions, TransportHandlers } from './types';

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
/** Reconnect backoff: 1s, 2s, 4s, 8s, then every 15s. */
function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 15_000);
}

export class WebSocketTransport implements GameTransport {
  private ws: WebSocket | null = null;
  /** Set while a session is live; cleared by disconnect() so we stop retrying. */
  private session: { sessionId: string; playerId: string; handlers: TransportHandlers } | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  /** Seat secret from create/join — the server refuses this seat without it. */
  private token: string | null = null;
  private readonly apiUrl: string;
  private readonly wsUrl: string;

  constructor(options: WebSocketTransportOptions = {}) {
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL;
    // If only apiUrl was supplied, derive a matching ws URL from it so
    // the UI doesn't have to ask the user to enter two URLs.
    this.wsUrl = options.wsUrl ?? (options.apiUrl ? deriveWsUrl(options.apiUrl) : DEFAULT_WS_URL);
  }

  private authHeader(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async createSession(name: string, playerName: string, options?: SessionOptions) {
    const res = await fetch(`${this.apiUrl}/api/game/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, playerName, maxPlayers: 30, ...options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    this.token = data.token;
    return { sessionId: data.session.id, playerId: data.player.id };
  }

  async joinSession(code: string, playerName: string) {
    const res = await fetch(`${this.apiUrl}/api/game/sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, playerName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    this.token = data.token;
    return { sessionId: data.sessionId, playerId: data.player.id };
  }

  async getLobby(sessionId: string): Promise<LobbyView> {
    const res = await fetch(`${this.apiUrl}/api/game/sessions/${sessionId}`, { headers: this.authHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return {
      code: data.session.code,
      status: data.session.status,
      hostPlayerId: data.session.hostPlayerId,
      players: data.players,
    };
  }

  async selectCountry(sessionId: string, _playerId: string, countryCode: string) {
    const res = await fetch(`${this.apiUrl}/api/game/sessions/${sessionId}/select-country`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeader() },
      body: JSON.stringify({ countryCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
  }

  async startGame(sessionId: string, _playerId: string): Promise<GameState> {
    const res = await fetch(`${this.apiUrl}/api/game/sessions/${sessionId}/start`, {
      method: 'POST',
      headers: this.authHeader(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return this.fetchState(sessionId);
  }

  async fetchState(sessionId: string): Promise<GameState> {
    const res = await fetch(`${this.apiUrl}/api/game/state/${sessionId}`, { headers: this.authHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.state as GameState;
  }

  connect(sessionId: string, playerId: string, handlers: TransportHandlers) {
    // Remember the session so a dropped socket can re-join on its own.
    this.session = { sessionId, playerId, handlers };
    this.open();
  }

  /** (Re)open the socket for the remembered session. */
  private open() {
    if (!this.session) return;
    const { sessionId, playerId, handlers } = this.session;
    const ws = new WebSocket(this.wsUrl);

    ws.onopen = () => {
      this.retryAttempt = 0;
      handlers.onConnected?.();
      ws.send(JSON.stringify({ type: 'join_session', payload: { sessionId, playerId, token: this.token } }));
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
      // Auto-rejoin unless disconnect() was called deliberately. The server
      // keys connections by playerId, so re-sending join_session restores the
      // player's slot and deltas resume on the next tick.
      if (this.session) {
        const delay = backoffMs(this.retryAttempt++);
        this.retryTimer = setTimeout(() => this.open(), delay);
      }
    };

    this.ws = ws;
  }

  disconnect() {
    // Clearing the session first stops onclose from scheduling a retry.
    this.session = null;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryAttempt = 0;
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
