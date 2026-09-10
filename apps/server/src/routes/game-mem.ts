import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { GameLoop, InMemoryGameStateStore, type GameLoopAdapter, createAIState, fogStateForPlayer } from '@conflict-game/game-engine';
import type { AIState } from '@conflict-game/game-engine';
import { broadcastToSession, sendToPlayer, getPlayerConnections } from '@conflict-game/game-transport';
import { getSession, getSessionPlayers, updateSession, updatePlayer, seatPlayer } from './lobby-mem.js';
import type { GameState, GameSettings, CountryState, IntelligenceState, TechnologyState } from '@conflict-game/shared-types';
import { SEED_COUNTRIES, defaultTechBonuses } from '@conflict-game/shared-types';
import { calculateIndexOfPower, PROCESSING_CHAINS, getStartingTechs, computeTechBonuses, createRNG } from '@conflict-game/game-logic';

/** Default intelligence state for a new country */
function defaultIntel(): IntelligenceState {
  return {
    intelBudget: 0,
    counterIntel: 20,
    disinfo: [],
    sigintActive: false,
    dossiers: {},
  };
}
/** Default tech state based on country's starting techLevel */
function defaultTech(techLevel: number): TechnologyState {
  const researchedTechs = getStartingTechs(techLevel);
  return {
    researchedTechs,
    activeResearch: null,
    bonuses: computeTechBonuses(researchedTechs),
  };
}

import { setStateResolver, setGameLoopRef, setSeatVerifier } from '@conflict-game/game-transport';

const store = new InMemoryGameStateStore();

/** WebSocket-backed adapter — injected into the game loop. */
const wsAdapter: GameLoopAdapter = {
  sendToPlayer,
  broadcast: (sessionId, message) => broadcastToSession(sessionId, message),
  getPlayerConnections,
};

const gameLoop = new GameLoop(store, wsAdapter);

// AI state per session: sessionId → countryCode → AIState
const aiStates = new Map<string, Map<string, AIState>>();
export { aiStates };

// Let WS handler look up game state and game loop for pause/resume
setStateResolver((sessionId) => store.getState(sessionId));
setGameLoopRef(gameLoop);
setSeatVerifier((sessionId, playerId, token) => seatPlayer(sessionId, token) === playerId);

// Wire AI states to game loop
gameLoop.setAIStates(aiStates);

export { gameLoop, store };

/** The caller's playerId, from the `Authorization: Bearer <seat token>` header. */
function seatFromRequest(request: FastifyRequest, sessionId: string): string | null {
  return seatPlayer(sessionId, request.headers.authorization?.replace(/^Bearer /, ''));
}

const fogRng = createRNG(Date.now());

/** What this player may see: their own country clearly, the rest through fog. */
function viewFor(state: GameState, playerId: string): GameState {
  const countryCode = state.players.find(p => p.id === playerId)?.countryCode ?? null;
  return fogStateForPlayer(state, countryCode, fogRng);
}

export const gameMemRoutes: FastifyPluginAsync = async (app) => {
  // GET /state/:sessionId — the caller's fogged view
  app.get<{ Params: { sessionId: string } }>('/state/:sessionId', async (request, reply) => {
    const playerId = seatFromRequest(request, request.params.sessionId);
    if (!playerId) return reply.status(401).send({ error: 'Seat token required' });
    const state = store.getState(request.params.sessionId);
    if (!state) return reply.status(404).send({ error: 'Game not active' });
    return { state: viewFor(state, playerId) };
  });

  // GET /events/:sessionId
  app.get<{ Params: { sessionId: string } }>('/events/:sessionId', async (request, reply) => {
    const playerId = seatFromRequest(request, request.params.sessionId);
    if (!playerId) return reply.status(401).send({ error: 'Seat token required' });
    const state = store.getState(request.params.sessionId);
    if (!state) return reply.status(404).send({ error: 'Game not active' });
    return { events: viewFor(state, playerId).events.slice(-50) };
  });

  // POST /sessions/:id/start
  app.post<{ Params: { id: string } }>('/sessions/:id/start', async (request, reply) => {
    const sessionId = request.params.id;
    const session = getSession(sessionId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    const playerId = seatFromRequest(request, sessionId);
    if (!playerId) return reply.status(401).send({ error: 'Seat token required' });
    if (playerId !== session.hostPlayerId) return reply.status(403).send({ error: 'Only the host can start the game' });
    if (session.status !== 'lobby') return reply.status(400).send({ error: 'Session not in lobby' });

    const sessionPlayers = getSessionPlayers(sessionId);
    if (sessionPlayers.length < 1) return reply.status(400).send({ error: 'Need at least 1 player' });

    const unready = sessionPlayers.filter(p => !p.countryCode);
    if (unready.length > 0) return reply.status(400).send({ error: 'Not all players selected a country' });

    // Initialize ALL seed countries in game state (not just player-selected ones)
    // This allows diplomacy, war, trade with any country
    const countries: Record<string, CountryState> = {};
    for (const seedCountry of SEED_COUNTRIES) {
      const state = { ...seedCountry.startingState, intel: defaultIntel(), tech: defaultTech(seedCountry.startingState.techLevel) };
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
      resourceMarket: { prices: {}, globalSupply: {}, globalDemand: {} },
      processingChains: PROCESSING_CHAINS,
    };

    store.setState(sessionId, gameState);

    // Initialize AI for all non-player countries (if AI enabled)
    const playerCountries = new Set(sessionPlayers.map(p => p.countryCode));
    const sessionAI = new Map<string, AIState>();
    if (settings.allowAI !== false) {
      const diff = settings.aiDifficulty ?? 'normal';
      for (const [code, country] of Object.entries(countries)) {
        if (!playerCountries.has(code)) {
          sessionAI.set(code, createAIState(code, country, diff));
        }
      }
    }
    aiStates.set(sessionId, sessionAI);
    console.log(`[AI] Initialized ${sessionAI.size} AI countries for session ${sessionId}`);

    gameLoop.start(sessionId);

    return { status: 'started', sessionId, aiCountries: sessionAI.size };
  });

  // POST /sessions/:id/select-country
  app.post<{ Params: { id: string } }>('/sessions/:id/select-country', async (request, reply) => {
    const { id: sessionId } = request.params;
    const playerId = seatFromRequest(request, sessionId);
    if (!playerId) return reply.status(401).send({ error: 'Seat token required' });
    if (getSession(sessionId)?.status !== 'lobby') return reply.status(400).send({ error: 'Session not in lobby' });
    const { countryCode } = request.body as { countryCode: string };

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
