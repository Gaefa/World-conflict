import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import type { AddressInfo } from 'node:net';
import { PAUSE_MAX_MS } from '@conflict-game/shared-types';
import { wsHandler } from '@conflict-game/game-transport';
import { lobbyMemRoutes } from '../src/routes/lobby-mem';
import { gameMemRoutes, gameLoop, store } from '../src/routes/game-mem';

/**
 * Real WebSocket clients against the in-memory server. The seat checks here
 * were live exploits found by driving two clients by hand: claiming another
 * player's country, hijacking a seat with a playerId leaked through the
 * state, reading the unfogged state, pausing everyone.
 */

let app: FastifyInstance;
let base: string;

beforeAll(async () => {
  app = Fastify();
  await app.register(websocket);
  await app.register(lobbyMemRoutes, { prefix: '/api/game' });
  await app.register(gameMemRoutes, { prefix: '/api/game' });
  app.get('/ws', { websocket: true }, wsHandler);
  await app.listen({ port: 0, host: '127.0.0.1' });
  base = `127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  gameLoop.stopAll();
  await app.close();
});

type Msg = { type: string; payload?: any };

async function api(path: string, opts: { body?: unknown; token?: string; method?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`http://${base}/api/game${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function connect() {
  const ws = new WebSocket(`ws://${base}/ws`);
  const msgs: Msg[] = [];
  ws.addEventListener('message', (e) => msgs.push(JSON.parse(String(e.data))));
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  return {
    msgs,
    of: (type: string) => msgs.filter((m) => m.type === type),
    send: (m: object) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
  };
}

// Captured before any test fakes timers: settling always needs real time.
const realSetTimeout = globalThis.setTimeout;
const settle = () => new Promise((r) => realSetTimeout(r, 100));

/** Run one tick now instead of waiting 10 s for the interval. Settles first
 *  so messages sent just before have reached the server's queue. */
async function tick(sessionId: string) {
  await settle();
  (gameLoop as unknown as { tick(id: string): void }).tick(sessionId);
  await settle();
}

async function createLobby() {
  const created = await api('/sessions', { body: { name: 'test', playerName: 'Host' } });
  return {
    sessionId: created.data.session.id as string,
    code: created.data.session.code as string,
    host: { id: created.data.player.id as string, token: created.data.token as string },
  };
}

async function lobby() {
  const l = await createLobby();
  const joined = await api('/sessions/join', { body: { code: l.code, playerName: 'Guest' } });
  const guest = { id: joined.data.player.id as string, token: joined.data.token as string };
  await api(`/sessions/${l.sessionId}/select-country`, { body: { countryCode: 'US' }, token: l.host.token });
  await api(`/sessions/${l.sessionId}/select-country`, { body: { countryCode: 'CN' }, token: guest.token });
  return { ...l, guest };
}

async function twoPlayerGame() {
  const l = await lobby();
  const { sessionId, host, guest } = l;
  // The guest's socket opens in the lobby, before any game state exists.
  const guestWs = await connect();
  guestWs.send({ type: 'join_session', payload: { sessionId, playerId: guest.id, token: guest.token } });
  const started = await api(`/sessions/${sessionId}/start`, { method: 'POST', token: host.token });
  expect(started.status).toBe(200);
  const hostWs = await connect();
  hostWs.send({ type: 'join_session', payload: { sessionId, playerId: host.id, token: host.token } });
  await settle();
  return { ...l, hostWs, guestWs };
}

describe('lobby', () => {
  it('joins only with a valid invite code, in any letter case', async () => {
    const { sessionId, code } = await createLobby();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    expect((await api('/sessions/join', { body: { code: 'ZZZZZZ', playerName: 'X' } })).status).toBe(404);
    const joined = await api('/sessions/join', { body: { code: code.toLowerCase(), playerName: 'Guest' } });
    expect(joined.status).toBe(201);
    expect(joined.data.sessionId).toBe(sessionId);
  });

  it('shows seat holders who picked what', async () => {
    const { sessionId, host, guest } = await lobby();
    expect((await api(`/sessions/${sessionId}`)).status).toBe(401);

    const { data } = await api(`/sessions/${sessionId}`, { token: guest.token });
    expect(data.session.hostPlayerId).toBe(host.id);
    expect(data.players.map((p: any) => [p.name, p.countryCode])).toEqual([['Host', 'US'], ['Guest', 'CN']]);
  });

  it('refuses a country that is already taken', async () => {
    const { sessionId, guest } = await lobby();
    const res = await api(`/sessions/${sessionId}/select-country`, { body: { countryCode: 'US' }, token: guest.token });
    expect(res.status).toBe(400);
  });

  it('drops a player who stopped polling, so they cannot block the start', async () => {
    const { sessionId, code, host } = await createLobby();
    const joined = await api('/sessions/join', { body: { code, playerName: 'Ghost' } });
    await api(`/sessions/${sessionId}/select-country`, { body: { countryCode: 'US' }, token: host.token });

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 31_000);
      const { data } = await api(`/sessions/${sessionId}`, { token: host.token });
      expect(data.players.map((p: any) => p.name)).toEqual(['Host']);
      expect((await api(`/sessions/${sessionId}`, { token: joined.data.token })).status).toBe(401);
      expect((await api(`/sessions/${sessionId}/start`, { method: 'POST', token: host.token })).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes the lobby when the host goes quiet', async () => {
    const { sessionId, guest } = await lobby();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 31_000);
      const { data } = await api(`/sessions/${sessionId}`, { token: guest.token });
      expect(data.session.status).toBe('finished');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('multiplayer seats', () => {
  it('a player acts only for the country of their own seat', async () => {
    const { sessionId, guestWs } = await twoPlayerGame();
    guestWs.send({ type: 'select_country', payload: { countryCode: 'US' } });
    guestWs.send({ type: 'player_action', payload: { type: 'set_tax_rate', rate: 0.9 } });
    await tick(sessionId);

    const state = store.getState(sessionId)!;
    expect(state.countries.CN.economy.taxRate).toBe(0.9);
    expect(state.countries.US.economy.taxRate).not.toBe(0.9);
  });

  it('join_session needs the seat token, so a leaked playerId cannot hijack a seat', async () => {
    const { sessionId, host, guest, hostWs } = await twoPlayerGame();

    const impostor = await connect();
    impostor.send({ type: 'join_session', payload: { sessionId, playerId: host.id, token: guest.token } });
    await settle();
    expect(impostor.of('error').map((m) => m.payload.code)).toContain('UNAUTHORIZED');

    impostor.send({ type: 'player_action', payload: { type: 'set_tax_rate', rate: 0.05 } });
    const deltasBefore = hostWs.of('state_delta').length;
    await tick(sessionId);

    expect(store.getState(sessionId)!.countries.US.economy.taxRate).not.toBe(0.05);
    expect(hostWs.of('state_delta').length).toBe(deltasBefore + 1);
    expect(impostor.of('state_delta')).toHaveLength(0);
  });

  it('REST calls need the seat token, and start/country are lobby-and-host rules', async () => {
    const l = await lobby();
    expect((await api(`/sessions/${l.sessionId}/select-country`, { body: { countryCode: 'FR' } })).status).toBe(401);
    expect((await api(`/sessions/${l.sessionId}/start`, { method: 'POST', token: l.guest.token })).status).toBe(403);
    expect((await api(`/sessions/${l.sessionId}/start`, { method: 'POST', token: l.host.token })).status).toBe(200);
    expect((await api(`/sessions/${l.sessionId}/select-country`, { body: { countryCode: 'FR' }, token: l.host.token })).status).toBe(400);
    expect((await api(`/state/${l.sessionId}`)).status).toBe(401);
    expect((await api(`/events/${l.sessionId}`)).status).toBe(401);
  });

  it('GET /state returns the requesting player\'s fogged view', async () => {
    const { sessionId, guest } = await twoPlayerGame();
    const { status, data } = await api(`/state/${sessionId}`, { token: guest.token });
    expect(status).toBe(200);
    expect(data.state.countries.CN.intel).toBeDefined();
    expect(data.state.countries.US.intel).toBeUndefined();
    expect(data.state.countries.US.resourceState).toEqual({});
  });

  it('a reconnect takes over the seat from the old socket', async () => {
    const { sessionId, host, hostWs } = await twoPlayerGame();
    const again = await connect();
    again.send({ type: 'join_session', payload: { sessionId, playerId: host.id, token: host.token } });
    await settle();

    const oldDeltas = hostWs.of('state_delta').length;
    await tick(sessionId);
    expect(again.of('state_delta')).toHaveLength(1);
    expect(hostWs.of('state_delta')).toHaveLength(oldDeltas);
  });
});

describe('pauses', () => {
  it('each player has two; only whoever paused can resume early', async () => {
    const { sessionId, guest, hostWs, guestWs } = await twoPlayerGame();
    const status = () => store.getState(sessionId)!.session.status;
    const toggle = async (ws: typeof hostWs) => { ws.send({ type: 'toggle_pause' }); await settle(); };

    await toggle(guestWs);
    expect(status()).toBe('paused');
    expect(hostWs.of('session_status').at(-1)!.payload).toMatchObject({ status: 'paused', playerId: guest.id });

    await toggle(hostWs);
    expect(hostWs.of('error').map((m) => m.payload.code)).toContain('NOT_YOUR_PAUSE');
    expect(status()).toBe('paused');

    await toggle(guestWs); // resume own pause
    expect(status()).toBe('active');
    await toggle(guestWs); // second pause
    await toggle(guestWs); // resume
    await toggle(guestWs); // third — over budget
    expect(guestWs.of('error').map((m) => m.payload.code)).toContain('NO_PAUSES_LEFT');
    expect(status()).toBe('active');
  });

  it('a pause ends by itself', async () => {
    const { sessionId, hostWs, guestWs } = await twoPlayerGame();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      hostWs.send({ type: 'toggle_pause' });
      await settle();
      expect(store.getState(sessionId)!.session.status).toBe('paused');

      vi.advanceTimersByTime(PAUSE_MAX_MS);
      await settle();
      expect(store.getState(sessionId)!.session.status).toBe('active');
      expect(guestWs.of('session_status').at(-1)!.payload.status).toBe('resumed');
    } finally {
      vi.useRealTimers();
    }
  });
});
