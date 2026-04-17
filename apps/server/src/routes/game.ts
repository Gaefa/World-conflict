import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { gameSessions, players, countryStates, gameEvents } from '../db/schema.js';
import { SEED_COUNTRIES } from '../db/seed-countries.js';
import { GameLoop, InMemoryGameStateStore, type GameLoopAdapter } from '@conflict-game/game-engine';
import { broadcastToSession, sendToPlayer, getPlayerConnections } from '../ws/handler.js';
import type { GameState, GameSettings, CountryState } from '@conflict-game/shared-types';
import { PROCESSING_CHAINS } from '@conflict-game/game-logic';

// Shared game loop instance (single-process, Phase 1 architecture)
const store = new InMemoryGameStateStore();
const wsAdapter: GameLoopAdapter = {
  sendToPlayer,
  broadcast: (sessionId, message) => broadcastToSession(sessionId, message),
  getPlayerConnections,
};
const gameLoop = new GameLoop(store, wsAdapter);

export { gameLoop, store };

export const gameRoutes: FastifyPluginAsync = async (app) => {
  // GET /state/:sessionId — full game state (reconnection)
  app.get<{ Params: { sessionId: string } }>('/state/:sessionId', async (request, reply) => {
    const state = store.getState(request.params.sessionId);
    if (!state) return reply.status(404).send({ error: 'Game not active' });
    return { state };
  });

  // GET /events/:sessionId — recent events
  app.get<{ Params: { sessionId: string } }>('/events/:sessionId', async (request, reply) => {
    const events = await db.select().from(gameEvents)
      .where(eq(gameEvents.sessionId, request.params.sessionId))
      .limit(50);
    return { events };
  });

  // POST /sessions/:id/start — start the game
  app.post<{ Params: { id: string } }>('/sessions/:id/start', async (request, reply) => {
    const sessionId = request.params.id;
    const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, sessionId));
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    if (session.status !== 'lobby') return reply.status(400).send({ error: 'Session not in lobby' });

    const sessionPlayers = await db.select().from(players).where(eq(players.sessionId, sessionId));
    if (sessionPlayers.length < 1) return reply.status(400).send({ error: 'Need at least 1 player' });

    // Check all players selected a country
    const unready = sessionPlayers.filter(p => !p.countryCode);
    if (unready.length > 0) return reply.status(400).send({ error: 'Not all players selected a country' });

    // Initialize country states from seed data
    const countries: Record<string, CountryState> = {};
    for (const p of sessionPlayers) {
      const seedCountry = SEED_COUNTRIES.find(c => c.code === p.countryCode);
      if (seedCountry) {
        countries[p.countryCode] = { ...seedCountry.startingState };
        // Also persist to DB
        await db.insert(countryStates).values({
          sessionId,
          countryCode: p.countryCode,
          economy: seedCountry.startingState.economy,
          military: seedCountry.startingState.military,
          resources: seedCountry.startingState.resources,
          stability: seedCountry.startingState.stability,
          approval: seedCountry.startingState.approval,
          techLevel: seedCountry.startingState.techLevel,
          diplomaticInfluence: seedCountry.startingState.diplomaticInfluence,
          indexOfPower: 0,
        });
      }
    }

    // Update session status
    await db.update(gameSessions)
      .set({ status: 'active', startedAt: new Date() })
      .where(eq(gameSessions.id, sessionId));

    // Create in-memory game state
    const settings = session.settings as GameSettings;
    const gameState: GameState = {
      session: {
        id: sessionId,
        name: session.name,
        hostPlayerId: session.hostPlayerId,
        status: 'active',
        settings,
        currentTick: 0,
        createdAt: session.createdAt.toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: null,
      },
      players: sessionPlayers.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.name,
        sessionId: p.sessionId,
        countryCode: p.countryCode,
        isAI: p.isAi,
        isReady: true,
        isOnline: p.isConnected,
        joinedAt: p.lastSeenAt.toISOString(),
      })),
      countries,
      armies: [],
      relations: [],
      events: [],
      tensionIndex: 20,
      resourceMarket: { prices: {}, globalSupply: {}, globalDemand: {} },
      processingChains: PROCESSING_CHAINS,
    };

    store.setState(sessionId, gameState);
    gameLoop.start(sessionId);

    return { status: 'started', sessionId };
  });

  // POST /sessions/:id/select-country
  app.post<{ Params: { id: string } }>('/sessions/:id/select-country', async (request, reply) => {
    const { id: sessionId } = request.params;
    const { playerId, countryCode } = request.body as { playerId: string; countryCode: string };

    if (!SEED_COUNTRIES.find(c => c.code === countryCode)) {
      return reply.status(400).send({ error: 'Invalid country code' });
    }

    // Check if country already taken
    const pls = await db.select().from(players).where(eq(players.sessionId, sessionId));
    if (pls.find(p => p.countryCode === countryCode && p.id !== playerId)) {
      return reply.status(400).send({ error: 'Country already taken' });
    }

    await db.update(players)
      .set({ countryCode })
      .where(eq(players.id, playerId));

    return { success: true, countryCode };
  });
};
