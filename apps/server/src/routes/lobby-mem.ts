import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID, randomInt } from 'crypto';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import type { GameSettings } from '@conflict-game/shared-types';

// In-memory storage (no DB required)
interface SessionRecord {
  id: string;
  /** Short invite code — the only way into a lobby. */
  code: string;
  name: string;
  status: string;
  settings: GameSettings;
  hostPlayerId: string;
  currentTick: number;
  createdAt: Date;
  startedAt: Date | null;
}

interface PlayerRecord {
  id: string;
  userId: string;
  sessionId: string;
  name: string;
  countryCode: string;
  isAi: boolean;
  isConnected: boolean;
  lastSeenAt: Date;
}

const sessions = new Map<string, SessionRecord>();
const playersList = new Map<string, PlayerRecord>();
/** Seat token → playerId. playerIds are visible to every player in the game
 *  state, so they can't double as credentials. */
const seatTokens = new Map<string, string>();

function issueSeat(playerId: string): string {
  const token = randomUUID();
  seatTokens.set(token, playerId);
  return token;
}

/** The playerId holding this seat token in this session, or null. */
export function seatPlayer(sessionId: string, token: string | undefined): string | null {
  const playerId = token ? seatTokens.get(token) : undefined;
  return playerId && playersList.get(playerId)?.sessionId === sessionId ? playerId : null;
}

/** The caller's playerId, from the `Authorization: Bearer <seat token>` header. */
export function seatFromRequest(request: FastifyRequest, sessionId: string): string | null {
  return seatPlayer(sessionId, request.headers.authorization?.replace(/^Bearer /, ''));
}

export function getSession(id: string) { return sessions.get(id); }
export function getSessionPlayers(sessionId: string) {
  return [...playersList.values()].filter(p => p.sessionId === sessionId);
}
export function updateSession(id: string, update: Partial<SessionRecord>) {
  const s = sessions.get(id);
  if (s) sessions.set(id, { ...s, ...update });
}
export function getPlayer(id: string) { return playersList.get(id); }
export function updatePlayer(id: string, update: Partial<PlayerRecord>) {
  const p = playersList.get(id);
  if (p) playersList.set(id, { ...p, ...update });
}

/** No 0/O or 1/I — the code gets read out loud and typed by hand. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newInviteCode(): string {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    if (![...sessions.values()].some(s => s.code === code && s.status !== 'finished')) return code;
  }
}

/** Lobby players poll GET /sessions/:id. Whoever goes quiet (closed the
 *  window, lost the connection) is dropped so they can't block the start. */
const LOBBY_TIMEOUT_MS = 30_000;

export function pruneLobby(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session?.status !== 'lobby') return;
  const cutoff = Date.now() - LOBBY_TIMEOUT_MS;
  for (const p of getSessionPlayers(sessionId)) {
    if (p.lastSeenAt.getTime() >= cutoff) continue;
    playersList.delete(p.id);
    for (const [token, pid] of seatTokens) if (pid === p.id) seatTokens.delete(token);
    // Only the host can start, so a lobby without one is over.
    if (p.id === session.hostPlayerId) updateSession(sessionId, { status: 'finished' });
  }
}

const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 30,
  tickIntervalMs: 10_000,
  sessionDurationTicks: 360,
  speed: 1,
  allowAI: true,
  aiDifficulty: 'normal',
  victoryConditions: ['domination', 'economic_hegemony', 'diplomatic', 'technological', 'survival'],
};

const CreateSessionBody = z.object({
  name: z.string().min(1).max(100),
  playerName: z.string().min(1),
  maxPlayers: z.number().int().min(2).max(30).optional(),
  allowAI: z.boolean().optional(),
  aiDifficulty: z.enum(['easy', 'normal', 'hard']).optional(),
});

const JoinSessionBody = z.object({
  code: z.string().min(1),
  playerName: z.string().min(1),
});

export const lobbyMemRoutes: FastifyPluginAsync = async (app) => {
  // GET /sessions
  app.get('/sessions', async () => {
    const result = [...sessions.values()]
      .filter(s => s.status !== 'finished')
      .map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        settings: s.settings,
        currentTick: s.currentTick,
        playerCount: getSessionPlayers(s.id).length,
        createdAt: s.createdAt.toISOString(),
      }));
    return { sessions: result };
  });

  // POST /sessions
  app.post('/sessions', async (request, reply) => {
    const parsed = CreateSessionBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { name, playerName, maxPlayers, allowAI, aiDifficulty } = parsed.data;
    const settings = {
      ...DEFAULT_SETTINGS,
      maxPlayers: maxPlayers ?? DEFAULT_SETTINGS.maxPlayers,
      allowAI: allowAI ?? DEFAULT_SETTINGS.allowAI,
      aiDifficulty: aiDifficulty ?? DEFAULT_SETTINGS.aiDifficulty,
    };

    const sessionId = randomUUID();
    const playerId = randomUUID();

    const session: SessionRecord = {
      id: sessionId,
      code: newInviteCode(),
      name,
      status: 'lobby',
      settings,
      hostPlayerId: playerId,
      currentTick: 0,
      createdAt: new Date(),
      startedAt: null,
    };

    const player: PlayerRecord = {
      id: playerId,
      userId: playerId,
      sessionId,
      name: playerName,
      countryCode: '',
      isAi: false,
      isConnected: true,
      lastSeenAt: new Date(),
    };

    sessions.set(sessionId, session);
    playersList.set(playerId, player);

    return reply.status(201).send({ session, player, token: issueSeat(playerId) });
  });

  // POST /sessions/join — enter a lobby by its invite code
  app.post('/sessions/join', async (request, reply) => {
    const parsed = JoinSessionBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const code = parsed.data.code.trim().toUpperCase();
    const found = [...sessions.values()].find(s => s.code === code && s.status === 'lobby');
    if (found) pruneLobby(found.id);
    const session = found && getSession(found.id);
    if (!session || session.status !== 'lobby') return reply.status(404).send({ error: 'Invalid invite code' });

    const pls = getSessionPlayers(session.id);
    if (pls.length >= session.settings.maxPlayers) return reply.status(400).send({ error: 'Session full' });

    const playerId = randomUUID();
    const player: PlayerRecord = {
      id: playerId,
      userId: playerId,
      sessionId: session.id,
      name: parsed.data.playerName,
      countryCode: '',
      isAi: false,
      isConnected: true,
      lastSeenAt: new Date(),
    };
    playersList.set(playerId, player);

    return reply.status(201).send({ sessionId: session.id, player, token: issueSeat(playerId) });
  });

  // GET /sessions/:id — lobby view for seat holders; polling it is the heartbeat
  app.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const playerId = seatFromRequest(request, request.params.id);
    if (!playerId) return reply.status(401).send({ error: 'Seat token required' });
    updatePlayer(playerId, { lastSeenAt: new Date() });
    pruneLobby(request.params.id);

    const session = sessions.get(request.params.id)!;
    return {
      session: {
        id: session.id,
        code: session.code,
        name: session.name,
        status: session.status,
        hostPlayerId: session.hostPlayerId,
      },
      players: getSessionPlayers(session.id).map(p => ({ id: p.id, name: p.name, countryCode: p.countryCode })),
    };
  });

  // GET /countries
  app.get('/countries', async () => {
    return {
      countries: SEED_COUNTRIES.map(c => ({
        code: c.code,
        name: c.name,
        capital: c.capital,
        region: c.region,
        subregion: c.subregion,
        latitude: c.latitude,
        longitude: c.longitude,
        area: c.area,
        population: c.population,
        flag: c.flag,
        startingState: c.startingState,
      })),
    };
  });
};
