/**
 * Pure tick engine — no transport, no logging, no setInterval.
 *
 * `runTick` advances the game state by one tick and returns everything
 * callers need to route the result (action results, deltas, events,
 * victory). It mutates `state` in place but also returns it for
 * convenience. Side-effectful callers (GameLoop) handle broadcasting
 * action_result messages, computing per-player fog, persisting state,
 * and stopping the interval on victory.
 *
 * This split unblocks:
 *   - running the engine inside a Web Worker (singleplayer)
 *   - snapshot-testing tick outputs deterministically (with seeded RNG)
 *   - replaying recorded action sequences
 */

import type {
  GameState,
  GameStateDelta,
  CountryState,
  GameEvent,
  PlayerAction,
  ActionResult,
} from '@conflict-game/shared-types';
import {
  processEconomyTick,
  processStabilityTick,
  calculateIndexOfPower,
  processResourceTick,
  processIntelTick,
  applyFog,
  processTechTick,
} from '@conflict-game/game-logic';
import type { RNG } from '@conflict-game/game-logic';
import { computeAIActions } from './ai/index';
import type { AIState } from './ai/index';
import { checkVictoryConditions } from './victory/index';
import type { VictoryResult } from './victory/index';
import { processAction } from './action-processor';
import type { QueuedAction } from './action-queue';

export interface TickInput {
  state: GameState;
  sessionId: string;
  queuedActions: QueuedAction[];
  /** AI countryCode → AIState. Missing = no AI for this session. */
  aiStates?: Map<string, AIState>;
  rng: RNG;
}

export interface ActionOutcome {
  playerId: string;
  countryCode: string;
  action: PlayerAction;
  result: ActionResult;
}

export interface AIOutcome {
  countryCode: string;
  action: PlayerAction;
  result: ActionResult;
}

export interface TickOutput {
  /** Same reference as input.state — mutated in place. */
  state: GameState;
  /** Full per-country deltas before fog. Use computePlayerDelta to fog. */
  countryDeltas: Record<string, Partial<CountryState>>;
  /** Events produced this tick (also appended to state.events). */
  newEvents: GameEvent[];
  /** Results for queued player actions (one per action). */
  actionResults: ActionOutcome[];
  /** Results for AI actions that ran this tick. */
  aiResults: AIOutcome[];
  /** Non-null only when a victory condition triggered this tick. */
  victoryResult: VictoryResult | null;
}

/** Advance the game by one tick. Pure w.r.t. I/O — only mutates `state`. */
export function runTick(input: TickInput): TickOutput {
  const { state, sessionId, queuedActions, aiStates, rng } = input;

  state.session.currentTick += 1;
  const tick = state.session.currentTick;

  const countryDeltas: Record<string, Partial<CountryState>> = {};
  const newEvents: GameEvent[] = [];
  const actionResults: ActionOutcome[] = [];
  const aiResults: AIOutcome[] = [];

  // 0. Process queued player actions
  for (const queued of queuedActions) {
    const result = processAction(state, queued.countryCode, queued.action, rng);
    actionResults.push({
      playerId: queued.playerId,
      countryCode: queued.countryCode,
      action: queued.action,
      result,
    });
  }

  // 0.1. AI actions
  if (aiStates) {
    for (const [code, aiState] of aiStates) {
      const aiActions = computeAIActions(state, aiState, tick, rng);
      for (const action of aiActions) {
        const result = processAction(state, code, action, rng);
        aiResults.push({ countryCode: code, action, result });
      }
    }
  }

  // 0.5. Resource tick
  const resourceResult = processResourceTick(state, rng);
  state.resourceMarket = resourceResult.resourceMarket;
  newEvents.push(...resourceResult.events);

  // 0.6. Intelligence tick
  const intelResult = processIntelTick(state, rng);
  newEvents.push(...intelResult.events);

  // 0.7. Technology tick
  const techResult = processTechTick(state);
  newEvents.push(...techResult.events);

  // Per-country: economy + sanctions + stability + indexOfPower
  for (const [code, country] of Object.entries(state.countries)) {
    // 1. Economy
    const econUpdate = processEconomyTick(country);
    country.economy = { ...country.economy, ...econUpdate };

    // 2. Sanctions
    const isAtWar = state.relations.some(
      r => (r.fromCountry === code || r.toCountry === code) && r.type === 'war' && r.status === 'active'
    );
    const activeSanctions = state.relations.filter(
      r => r.toCountry === code && r.type === 'sanction' && r.status === 'active'
    );
    const sanctionCount = activeSanctions.length;

    if (sanctionCount > 0) {
      let totalPressure = 0;
      for (const sanction of activeSanctions) {
        const sanctioner = state.countries[sanction.fromCountry];
        if (!sanctioner) continue;

        const duration = tick - sanction.createdAtTick;
        const durationFactor = Math.min(1, duration / 12);
        const gdpRatio = sanctioner.economy.gdp / Math.max(1, country.economy.gdp);
        const weightFactor = Math.min(2, gdpRatio * 0.5);

        totalPressure += weightFactor * durationFactor;

        // Blowback on sanctioner
        const tradeImpact = country.economy.gdp * 0.001 * durationFactor;
        sanctioner.economy.tradeBalance -= tradeImpact;
        sanctioner.economy.inflation += 0.02 * durationFactor;

        if (country.resources.oil > 50 || country.resources.gas > 50) {
          sanctioner.economy.inflation += 0.05 * durationFactor;
          sanctioner.economy.gdpGrowth -= 0.03 * durationFactor;
        }
      }

      const resilience = country.economy.sanctionResilience / 100;
      const evasion = country.economy.sanctionEvasion / 100;
      const effectivePressure = totalPressure * (1 - resilience * 0.5) * (1 - evasion * 0.4);

      country.economy.gdpGrowth -= effectivePressure * 0.3;
      country.economy.inflation += effectivePressure * 0.5;
      country.economy.tradeBalance -= effectivePressure * 5;
      country.economy.budget -= effectivePressure * 0.5;

      country.economy.sanctionEvasion = Math.min(90, country.economy.sanctionEvasion + 0.3);
    }

    // 3. Stability
    const stabilityResult = processStabilityTick(country, isAtWar, sanctionCount);
    country.stability = clamp(country.stability + stabilityResult.stabilityDelta, 0, 100);
    country.approval = clamp(country.approval + stabilityResult.approvalDelta, 0, 100);

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

    // 4. Index of Power
    country.indexOfPower = calculateIndexOfPower(country);

    countryDeltas[code] = {
      economy: { ...country.economy },
      stability: country.stability,
      approval: country.approval,
      indexOfPower: country.indexOfPower,
      intel: country.intel ? { ...country.intel } : undefined,
      tech: country.tech ? { ...country.tech } : undefined,
    };
  }

  // 5. Global tension
  const avgStability =
    Object.values(state.countries).reduce((s, c) => s + c.stability, 0) /
    Math.max(1, Object.keys(state.countries).length);
  const warCount = state.relations.filter(r => r.type === 'war' && r.status === 'active').length;
  state.tensionIndex = clamp(100 - avgStability + warCount * 10, 0, 100);

  // 6. Random events (every 30 ticks)
  if (tick % 30 === 0) {
    const countryCodes = Object.keys(state.countries);
    const randomCode = countryCodes[Math.floor(rng() * countryCodes.length)];
    const randomEvent = generateRandomEvent(tick, sessionId, randomCode, rng);
    if (randomEvent) {
      newEvents.push(randomEvent);
      applyEventEffect(state.countries[randomCode], randomEvent);
    }
  }

  // 7. Victory check (every 10 ticks, and at session end)
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
        data: {
          winner: victoryResult.winner,
          condition: victoryResult.condition,
          scores: victoryResult.scores,
        },
        createdAt: new Date().toISOString(),
      });
      state.session.status = 'finished';
      state.session.finishedAt = new Date().toISOString();
    }
  }

  // Append events, keep recent 100
  state.events.push(...newEvents);
  if (state.events.length > 100) {
    state.events = state.events.slice(-100);
  }

  return { state, countryDeltas, newEvents, actionResults, aiResults, victoryResult };
}

/**
 * Build a per-player fogged GameStateDelta. Own country gets the full
 * delta; other countries are fogged based on the observer's intel.
 * Intel-sensitive events are filtered unless the player is involved.
 */
export function computePlayerDelta(
  state: GameState,
  countryDeltas: Record<string, Partial<CountryState>>,
  newEvents: GameEvent[],
  playerCountryCode: string | null,
  rng: RNG,
): GameStateDelta {
  const playerIntel = playerCountryCode ? state.countries[playerCountryCode]?.intel : undefined;
  const foggedDeltas: Record<string, Partial<CountryState>> = {};

  for (const [code, changes] of Object.entries(countryDeltas)) {
    if (code === playerCountryCode) {
      foggedDeltas[code] = changes;
    } else {
      const realCountry = state.countries[code];
      if (realCountry) {
        const fogged = applyFog(realCountry, playerIntel, playerCountryCode ?? '', rng);
        foggedDeltas[code] = {
          economy: { ...fogged.economy },
          stability: fogged.stability,
          approval: fogged.approval,
          indexOfPower: fogged.indexOfPower,
        };
      }
    }
  }

  const playerEvents = newEvents.filter(e => {
    if (e.type === 'spy_caught' || e.type === 'spy_success' || e.type === 'intel_breakthrough') {
      return e.involvedCountries.includes(playerCountryCode ?? '');
    }
    return true;
  });

  return {
    tick: state.session.currentTick,
    countries: foggedDeltas,
    relations: state.relations,
    events: playerEvents.length > 0 ? playerEvents : undefined,
    tensionIndex: state.tensionIndex,
    resourceMarket: state.resourceMarket,
  };
}

// ── helpers (duplicated from loop.ts; kept pure and local) ──

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

function generateRandomEvent(tick: number, sessionId: string, countryCode: string, rng: RNG): GameEvent | null {
  if (rng() > 0.6) return null;
  const template = RANDOM_EVENTS[Math.floor(rng() * RANDOM_EVENTS.length)];
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
