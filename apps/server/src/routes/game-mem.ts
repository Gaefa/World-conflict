import type { FastifyPluginAsync } from 'fastify';
import { SEED_COUNTRIES } from '../db/seed-countries.js';
import { GameLoop, InMemoryGameStateStore } from '../game/loop.js';
import { getSession, getSessionPlayers, updateSession, updatePlayer } from './lobby-mem.js';
import type { GameState, GameSettings, CountryState, IntelligenceState, TechnologyState } from '@conflict-game/shared-types';
import { defaultTechBonuses } from '@conflict-game/shared-types';
import { calculateIndexOfPower, PROCESSING_CHAINS, getStartingTechs, computeTechBonuses, createAIState } from '@conflict-game/game-logic';
import type { AIState } from '@conflict-game/game-logic';

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

import { setStateResolver, setGameLoopRef } from '../ws/handler.js';

const store = new InMemoryGameStateStore();
const gameLoop = new GameLoop(store);

// AI state per session: sessionId → countryCode → AIState
const aiStates = new Map<string, Map<string, AIState>>();
export { aiStates };

// Let WS handler look up game state and game loop for pause/resume
setStateResolver((sessionId) => store.getState(sessionId));
setGameLoopRef(gameLoop);

// Wire AI states to game loop
gameLoop.setAIStates(aiStates);

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
