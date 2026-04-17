import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import type { GameSettings } from '@conflict-game/shared-types';

// In-memory storage (no DB required)
interface SessionRecord {
  id: string;
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

    return reply.status(201).send({ session, player });
  });

  // POST /sessions/:id/join
  app.post<{ Params: { id: string } }>('/sessions/:id/join', async (request, reply) => {
    const parsed = JoinSessionBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { id: sessionId } = request.params;
    const session = sessions.get(sessionId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    if (session.status !== 'lobby') return reply.status(400).send({ error: 'Session not in lobby' });

    const pls = getSessionPlayers(sessionId);
    if (pls.length >= session.settings.maxPlayers) return reply.status(400).send({ error: 'Session full' });

    const playerId = randomUUID();
    const player: PlayerRecord = {
      id: playerId,
      userId: playerId,
      sessionId,
      name: parsed.data.playerName,
      countryCode: '',
      isAi: false,
      isConnected: true,
      lastSeenAt: new Date(),
    };
    playersList.set(playerId, player);

    return reply.status(201).send({ player });
  });

  // GET /sessions/:id
  app.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const session = sessions.get(request.params.id);
    if (!session) return reply.status(404).send({ error: 'Not found' });
    return { session, players: getSessionPlayers(session.id) };
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
