import type { FastifyPluginAsync } from 'fastify';
import { SEED_COUNTRIES } from '../db/seed-countries.js';
import { GameLoop, InMemoryGameStateStore } from '../game/loop.js';
import { getSession, getSessionPlayers, updateSession, updatePlayer } from './lobby-mem.js';
import type { GameState, GameSettings, CountryState } from '@conflict-game/shared-types';
import { calculateIndexOfPower } from '@conflict-game/game-logic';
import { setStateResolver } from '../ws/handler.js';

const store = new InMemoryGameStateStore();
const gameLoop = new GameLoop(store);

// Let WS handler look up game state for player→country mapping
setStateResolver((sessionId) => store.getState(sessionId));

export { gameLoop, store };

export const gameMemRoutes: FastifyPluginAsync = async (app) => {
  // GET /state/:sessionId
  app.get<{ Params: { sessionId: string } }>('/state/:sessionId', async (request, reply) => {
    const state = store.getState(request.params.sessionId);
    if (!state) return reply.status(404).send({ error: 'Game not active' });
    return { state };
  });

  // GET /events/:sessionId
  app.get<{ Params: { sessionId: string } }>('/events/:sessionId', async (request, reply) => {
    const state = store.getState(request.params.sessionId);
    if (!state) return reply.status(404).send({ error: 'Game not active' });
    return { events: state.events.slice(-50) };
  });

  // POST /sessions/:id/start
  app.post<{ Params: { id: string } }>('/sessions/:id/start', async (request, reply) => {
    const sessionId = request.params.id;
    const session = getSession(sessionId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    if (session.status !== 'lobby') return reply.status(400).send({ error: 'Session not in lobby' });

    const sessionPlayers = getSessionPlayers(sessionId);
    if (sessionPlayers.length < 1) return reply.status(400).send({ error: 'Need at least 1 player' });

    const unready = sessionPlayers.filter(p => !p.countryCode);
    if (unready.length > 0) return reply.status(400).send({ error: 'Not all players selected a country' });

    // Initialize ALL seed countries in game state (not just player-selected ones)
    // This allows diplomacy, war, trade with any country
    const countries: Record<string, CountryState> = {};
    for (const seedCountry of SEED_COUNTRIES) {
      const state = { ...seedCountry.startingState };
      state.indexOfPower = calculateIndexOfPower(state);
      countries[seedCountry.code] = state;
    }

    updateSession(sessionId, { status: 'active', startedAt: new Date() });

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

    const pls = getSessionPlayers(sessionId);
    if (pls.find(p => p.countryCode === countryCode && p.id !== playerId)) {
      return reply.status(400).send({ error: 'Country already taken' });
    }

    updatePlayer(playerId, { countryCode });

    return { success: true, countryCode };
  });
};
