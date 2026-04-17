import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { gameSessions, players } from '../db/schema.js';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import type { GameSettings } from '@conflict-game/shared-types';

const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 8,
  tickIntervalMs: 10_000,
  sessionDurationTicks: 360,
  speed: 1,
  allowAI: true,
  aiDifficulty: 'normal',
  victoryConditions: ['domination', 'economic_hegemony', 'diplomatic', 'technological', 'survival'],
};

const CreateSessionBody = z.object({
  name: z.string().min(1).max(100),
  hostUserId: z.string().min(1),
  hostUsername: z.string().min(1),
  settings: z.object({
    maxPlayers: z.number().int().min(2).max(30).optional(),
    tickIntervalMs: z.number().int().min(1000).optional(),
    speed: z.number().min(0.5).max(8).optional(),
    allowAI: z.boolean().optional(),
  }).optional(),
});

const JoinSessionBody = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
});

export const lobbyRoutes: FastifyPluginAsync = async (app) => {
  // GET /sessions — list active sessions
  app.get('/sessions', async () => {
    const sessions = await db
      .select()
      .from(gameSessions)
      .where(ne(gameSessions.status, 'finished'));

    const result = await Promise.all(
      sessions.map(async (s) => {
        const pls = await db.select().from(players).where(eq(players.sessionId, s.id));
        return {
          id: s.id, name: s.name, status: s.status,
          settings: s.settings as GameSettings,
          currentTick: s.currentTick,
          playerCount: pls.length,
          createdAt: s.createdAt.toISOString(),
        };
      }),
    );
    return { sessions: result };
  });

  // POST /sessions — create session
  app.post('/sessions', async (request, reply) => {
    const parsed = CreateSessionBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { name, hostUserId, hostUsername, settings: partial } = parsed.data;
    const mergedSettings: GameSettings = { ...DEFAULT_SETTINGS, ...partial };

    const result = await db.transaction(async (tx) => {
      const [session] = await tx.insert(gameSessions).values({
        name, status: 'lobby', settings: mergedSettings,
        hostPlayerId: 'pending', currentTick: 0,
      }).returning();

      const [player] = await tx.insert(players).values({
        userId: hostUserId, sessionId: session.id,
        name: hostUsername, countryCode: '', isAi: false, isConnected: true,
      }).returning();

      const [updated] = await tx.update(gameSessions)
        .set({ hostPlayerId: player.id })
        .where(eq(gameSessions.id, session.id)).returning();

      return { session: updated, player };
    });

    return reply.status(201).send({ session: result.session, player: result.player });
  });

  // POST /sessions/:id/join
  app.post<{ Params: { id: string } }>('/sessions/:id/join', async (request, reply) => {
    const parsed = JoinSessionBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { id: sessionId } = request.params;
    const { userId, username } = parsed.data;

    const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, sessionId));
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    if (session.status !== 'lobby') return reply.status(400).send({ error: 'Session not in lobby' });

    const pls = await db.select().from(players).where(eq(players.sessionId, sessionId));
    const settings = session.settings as GameSettings;
    if (pls.length >= settings.maxPlayers) return reply.status(400).send({ error: 'Session full' });
    if (pls.find(p => p.userId === userId)) return reply.status(400).send({ error: 'Already joined' });

    const [player] = await db.insert(players).values({
      userId, sessionId, name: username, countryCode: '', isAi: false, isConnected: true,
    }).returning();

    return reply.status(201).send({ player });
  });

  // GET /sessions/:id
  app.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, request.params.id));
    if (!session) return reply.status(404).send({ error: 'Not found' });
    const pls = await db.select().from(players).where(eq(players.sessionId, session.id));
    return { session, players: pls };
  });

  // GET /countries — available countries
  app.get('/countries', async () => {
    return {
      countries: SEED_COUNTRIES.map(c => ({
        code: c.code, name: c.name, capital: c.capital, region: c.region,
        latitude: c.latitude, longitude: c.longitude, population: c.population, flag: c.flag,
      })),
    };
  });
};
