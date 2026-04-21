import type { GameState, GameStateDelta, CountryState, GameEvent, ServerMessage } from '@conflict-game/shared-types';
import { processEconomyTick, processStabilityTick, calculateIndexOfPower, processResourceTick, processIntelTick, applyFog, processTechTick, computeAIActions, checkVictoryConditions } from '@conflict-game/game-logic';
import type { VictoryResult } from '@conflict-game/game-logic';
import type { AIState } from '@conflict-game/game-logic';
import { drainActions } from './action-queue';
import { processAction } from './action-processor';

export interface GameStateStore {
  getState(sessionId: string): GameState | null;
  setState(sessionId: string, state: GameState): void;
}

/**
 * Transport-agnostic interface the game loop uses to reach players.
 * Server passes a WebSocket-backed implementation; single-player passes an in-process one.
 */
export interface GameLoopAdapter {
  sendToPlayer(playerId: string, message: ServerMessage): void;
  broadcast(sessionId: string, message: ServerMessage): void;
  getPlayerConnections(sessionId: string): { playerId: string; countryCode: string | null }[];
}

export class InMemoryGameStateStore implements GameStateStore {
  private states = new Map<string, GameState>();

  getState(sessionId: string): GameState | null {
    return this.states.get(sessionId) ?? null;
  }

  setState(sessionId: string, state: GameState): void {
    this.states.set(sessionId, state);
  }

  removeState(sessionId: string): void {
    this.states.delete(sessionId);
  }

  getAllSessions(): string[] {
    return [...this.states.keys()];
  }
}

export class GameLoop {
  private intervals = new Map<string, ReturnType<typeof setInterval>>();
  private store: GameStateStore;
  private adapter: GameLoopAdapter;
  private tickIntervalMs: number;
  private aiStatesRef: Map<string, Map<string, AIState>> | null = null;

  constructor(store: GameStateStore, adapter: GameLoopAdapter, tickIntervalMs: number = 10_000) {
    this.store = store;
    this.adapter = adapter;
    this.tickIntervalMs = tickIntervalMs;
  }

  setAIStates(ref: Map<string, Map<string, AIState>>): void {
    this.aiStatesRef = ref;
  }

  get stateStore(): GameStateStore {
    return this.store;
  }

  start(sessionId: string): void {
    if (this.intervals.has(sessionId)) return;
    console.log(`[GameLoop] Starting session ${sessionId}, tick every ${this.tickIntervalMs}ms`);
    const id = setInterval(() => this.tick(sessionId), this.tickIntervalMs);
    this.intervals.set(sessionId, id);
  }

  stop(sessionId: string): void {
    const id = this.intervals.get(sessionId);
    if (id) {
      clearInterval(id);
      this.intervals.delete(sessionId);
      console.log(`[GameLoop] Stopped session ${sessionId}`);
    }
  }

  pause(sessionId: string): boolean {
    const state = this.store.getState(sessionId);
    if (!state) return false;
    const id = this.intervals.get(sessionId);
    if (id) {
      clearInterval(id);
      this.intervals.delete(sessionId);
    }
    state.session.status = 'paused';
    this.store.setState(sessionId, state);
    console.log(`[GameLoop] Paused session ${sessionId}`);
    return true;
  }

  resume(sessionId: string): boolean {
    const state = this.store.getState(sessionId);
    if (!state || state.session.status !== 'paused') return false;
    state.session.status = 'active';
    this.store.setState(sessionId, state);
    this.start(sessionId);
    console.log(`[GameLoop] Resumed session ${sessionId}`);
    return true;
  }

  isPaused(sessionId: string): boolean {
    const state = this.store.getState(sessionId);
    return state?.session.status === 'paused';
  }

  stopAll(): void {
    for (const [sid] of this.intervals) {
      this.stop(sid);
    }
  }

  private tick(sessionId: string): void {
    const state = this.store.getState(sessionId);
    if (!state || state.session.status !== 'active') return;

    state.session.currentTick += 1;
    const tick = state.session.currentTick;

    const countryDeltas: Record<string, Partial<CountryState>> = {};
    const newEvents: GameEvent[] = [];

    // 0. Process queued player actions
    const pendingActions = drainActions(sessionId);
    for (const queued of pendingActions) {
      const result = processAction(state, queued.countryCode, queued.action);
      // Send result back to the player who submitted the action
      this.adapter.sendToPlayer(queued.playerId, {
        type: 'action_result',
        payload: result,
      });
      console.log(`[GameLoop] Action ${queued.action.type} by ${queued.countryCode}: ${result.success ? 'OK' : result.message}`);
    }

    // 0.1. AI actions — AI countries decide and act
    if (this.aiStatesRef) {
      const sessionAI = this.aiStatesRef.get(sessionId);
      if (sessionAI) {
        for (const [code, aiState] of sessionAI) {
          const aiActions = computeAIActions(state, aiState, tick);
          for (const action of aiActions) {
            const result = processAction(state, code, action);
            if (result.success) {
              console.log(`[AI] ${code} → ${action.type}: OK`);
            }
          }
        }
      }
    }

    // 0.5. Resource tick (cross-country: production, trade flows, deficits, prices)
    const resourceResult = processResourceTick(state);
    state.resourceMarket = resourceResult.resourceMarket;
    newEvents.push(...resourceResult.events);

    // 0.6. Intelligence tick (spy ops, counterintel, disinfo)
    const intelResult = processIntelTick(state);
    newEvents.push(...intelResult.events);

    // 0.7. Technology tick
    const techResult = processTechTick(state);
    newEvents.push(...techResult.events);

    // Process each country
    for (const [code, country] of Object.entries(state.countries)) {
      // 1. Economy tick
      const econUpdate = processEconomyTick(country);
      country.economy = { ...country.economy, ...econUpdate };

      // 2. Sanctions processing — realistic escalation
      const isAtWar = state.relations.some(
        r => (r.fromCountry === code || r.toCountry === code) && r.type === 'war' && r.status === 'active'
      );
      const activeSanctions = state.relations.filter(
        r => r.toCountry === code && r.type === 'sanction' && r.status === 'active'
      );
      const sanctionCount = activeSanctions.length;

      if (sanctionCount > 0) {
        // Calculate total sanctions pressure
        let totalPressure = 0;
        for (const sanction of activeSanctions) {
          const sanctioner = state.countries[sanction.fromCountry];
          if (!sanctioner) continue;

          // Duration factor: sanctions escalate over time (months)
          const duration = tick - sanction.createdAtTick;
          const durationFactor = Math.min(1, duration / 12); // full effect after 12 months

          // Economic weight: bigger economy = more painful sanctions
          const gdpRatio = sanctioner.economy.gdp / Math.max(1, country.economy.gdp);
          const weightFactor = Math.min(2, gdpRatio * 0.5);

          totalPressure += weightFactor * durationFactor;

          // BLOWBACK: sanctioner also suffers (lost trade partner)
          const tradeImpact = country.economy.gdp * 0.001 * durationFactor;
          sanctioner.economy.tradeBalance -= tradeImpact;
          sanctioner.economy.inflation += 0.02 * durationFactor;

          // Resource blowback: if target is resource producer, sanctioner pays more
          if (country.resources.oil > 50 || country.resources.gas > 50) {
            sanctioner.economy.inflation += 0.05 * durationFactor; // energy prices rise
            sanctioner.economy.gdpGrowth -= 0.03 * durationFactor;
          }
        }

        // Apply to target, reduced by resilience and evasion
        const resilience = country.economy.sanctionResilience / 100;
        const evasion = country.economy.sanctionEvasion / 100;
        const effectivePressure = totalPressure * (1 - resilience * 0.5) * (1 - evasion * 0.4);

        country.economy.gdpGrowth -= effectivePressure * 0.3;
        country.economy.inflation += effectivePressure * 0.5;
        country.economy.tradeBalance -= effectivePressure * 5;
        country.economy.budget -= effectivePressure * 0.5;

        // Evasion slowly improves over time (adaptation)
        country.economy.sanctionEvasion = Math.min(90, country.economy.sanctionEvasion + 0.3);
      }

      // 3. Stability tick

      const stabilityResult = processStabilityTick(country, isAtWar, sanctionCount);
      country.stability = clamp(country.stability + stabilityResult.stabilityDelta, 0, 100);
      country.approval = clamp(country.approval + stabilityResult.approvalDelta, 0, 100);

      // 3. Revolution risk event
      if (stabilityResult.revolutionRisk > 0.5 && tick % 10 === 0) {
        newEvents.push({
          id: `evt-${tick}-${code}-unrest`,
          sessionId,
          type: 'civil_unrest',
          title: `Civil unrest in ${code}`,
          description: `Revolution risk: ${(stabilityResult.revolutionRisk * 100).toFixed(0)}%`,
          severity: stabilityResult.revolutionRisk > 0.8 ? 'critical' : 'high',
          involvedCountries: [code],
          tick,
          data: { revolutionRisk: stabilityResult.revolutionRisk },
          createdAt: new Date().toISOString(),
        });
      }

      // 4. Recalculate Index of Power
      country.indexOfPower = calculateIndexOfPower(country);

      // Track delta
      countryDeltas[code] = {
        economy: { ...country.economy },
        stability: country.stability,
        approval: country.approval,
        indexOfPower: country.indexOfPower,
        intel: country.intel ? { ...country.intel } : undefined,
        tech: country.tech ? { ...country.tech } : undefined,
      };
    }

    // 5. Update global tension
    const avgStability = Object.values(state.countries).reduce((s, c) => s + c.stability, 0) / Math.max(1, Object.keys(state.countries).length);
    const warCount = state.relations.filter(r => r.type === 'war' && r.status === 'active').length;
    state.tensionIndex = clamp(100 - avgStability + warCount * 10, 0, 100);

    // 6. Random events (every 30 ticks)
    if (tick % 30 === 0) {
      const countryCodes = Object.keys(state.countries);
      const randomCode = countryCodes[Math.floor(Math.random() * countryCodes.length)];
      const randomEvent = generateRandomEvent(tick, sessionId, randomCode);
      if (randomEvent) {
        newEvents.push(randomEvent);
        applyEventEffect(state.countries[randomCode], randomEvent);
      }
    }

    // 7. Victory check (every 10 ticks to avoid overhead)
    let victoryResult: VictoryResult | null = null;
    if (tick % 10 === 0 || tick >= state.session.settings.sessionDurationTicks) {
      victoryResult = checkVictoryConditions(state);
      if (victoryResult.achieved) {
        newEvents.push({
          id: `evt-${tick}-victory`,
          sessionId,
          type: 'victory' as GameEvent['type'],
          title: `${victoryResult.winner} wins!`,
          description: `Victory by ${victoryResult.condition}`,
          severity: 'critical',
          involvedCountries: victoryResult.winner ? [victoryResult.winner] : [],
          tick,
          data: { winner: victoryResult.winner, condition: victoryResult.condition, scores: victoryResult.scores },
          createdAt: new Date().toISOString(),
        });
        state.session.status = 'finished';
        state.session.finishedAt = new Date().toISOString();
      }
    }

    // Add events to state
    state.events.push(...newEvents);
    if (state.events.length > 100) {
      state.events = state.events.slice(-100);
    }

    this.store.setState(sessionId, state);

    // Stop loop if game finished
    if (victoryResult?.achieved) {
      console.log(`[GameLoop] Game over! Winner: ${victoryResult.winner} by ${victoryResult.condition}`);
      this.stop(sessionId);
    }

    // Per-player fog: each player sees fogged data for other countries
    const playerConns = this.adapter.getPlayerConnections(sessionId);
    for (const { playerId, countryCode } of playerConns) {
      const playerIntel = countryCode ? state.countries[countryCode]?.intel : undefined;
      const foggedDeltas: Record<string, Partial<CountryState>> = {};

      for (const [code, changes] of Object.entries(countryDeltas)) {
        if (code === countryCode) {
          // Own country: full data
          foggedDeltas[code] = changes;
        } else {
          // Other countries: apply fog
          const realCountry = state.countries[code];
          if (realCountry) {
            const fogged = applyFog(realCountry, playerIntel, countryCode ?? '');
            foggedDeltas[code] = {
              economy: { ...fogged.economy },
              stability: fogged.stability,
              approval: fogged.approval,
              indexOfPower: fogged.indexOfPower,
            };
          }
        }
      }

      // Filter events: hide intel events not involving this player
      const playerEvents = newEvents.filter(e => {
        if (e.type === 'spy_caught' || e.type === 'spy_success' || e.type === 'intel_breakthrough') {
          return e.involvedCountries.includes(countryCode ?? '');
        }
        return true; // all other events are public
      });

      const playerDelta: GameStateDelta = {
        tick,
        countries: foggedDeltas,
        relations: state.relations,
        events: playerEvents.length > 0 ? playerEvents : undefined,
        tensionIndex: state.tensionIndex,
        resourceMarket: state.resourceMarket,
      };

      this.adapter.sendToPlayer(playerId, { type: 'state_delta', payload: playerDelta });
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const RANDOM_EVENTS = [
  { type: 'natural_disaster', title: 'Earthquake', severity: 'high' as const, stabilityDelta: -5, gdpDelta: -0.3 },
  { type: 'natural_disaster', title: 'Hurricane', severity: 'medium' as const, stabilityDelta: -3, gdpDelta: -0.2 },
  { type: 'economic_crisis', title: 'Market crash', severity: 'high' as const, stabilityDelta: -4, gdpDelta: -1 },
  { type: 'economic_boom', title: 'Tech boom', severity: 'low' as const, stabilityDelta: 2, gdpDelta: 0.5 },
  { type: 'political_scandal', title: 'Corruption scandal', severity: 'medium' as const, stabilityDelta: -6, gdpDelta: 0 },
  { type: 'diplomatic_incident', title: 'Embassy incident', severity: 'medium' as const, stabilityDelta: -2, gdpDelta: 0 },
  { type: 'resource_discovery', title: 'Oil field discovered', severity: 'low' as const, stabilityDelta: 1, gdpDelta: 0.3 },
  { type: 'pandemic', title: 'Disease outbreak', severity: 'high' as const, stabilityDelta: -8, gdpDelta: -0.5 },
  { type: 'military_incident', title: 'Border skirmish', severity: 'medium' as const, stabilityDelta: -3, gdpDelta: -0.1 },
  { type: 'cultural_event', title: 'International summit', severity: 'low' as const, stabilityDelta: 3, gdpDelta: 0.1 },
];

function generateRandomEvent(tick: number, sessionId: string, countryCode: string): GameEvent | null {
  if (Math.random() > 0.6) return null; // 60% chance of event
  const template = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
  return {
    id: `evt-${tick}-${countryCode}-random`,
    sessionId,
    type: template.type as GameEvent['type'],
    title: `${template.title} in ${countryCode}`,
    description: `A ${template.title.toLowerCase()} has occurred, affecting the region.`,
    severity: template.severity,
    involvedCountries: [countryCode],
    tick,
    data: { stabilityDelta: template.stabilityDelta, gdpDelta: template.gdpDelta },
    createdAt: new Date().toISOString(),
  };
}

function applyEventEffect(country: CountryState, event: GameEvent): void {
  const data = event.data as { stabilityDelta?: number; gdpDelta?: number };
  if (data.stabilityDelta) {
    country.stability = clamp(country.stability + data.stabilityDelta, 0, 100);
  }
  if (data.gdpDelta) {
    country.economy.gdp += country.economy.gdp * (data.gdpDelta / 100);
  }
}
