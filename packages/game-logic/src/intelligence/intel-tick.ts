import type {
  GameState,
  CountryState,
  GameEvent,
  IntelligenceState,
  CountryDossier,
  IntelLevel,
  SpyOperation,
} from '@conflict-game/shared-types';
import {
  SPY_OP_CONFIG,
  INTEL_THRESHOLDS,
} from '@conflict-game/shared-types';
import type { RNG } from '../rng';

// ── Intelligence Tick ──
// Runs once per game tick. Processes spy ops, counterintel, disinfo, SIGINT.

export interface IntelTickResult {
  events: GameEvent[];
}

export function processIntelTick(state: GameState, rng: RNG): IntelTickResult {
  const events: GameEvent[] = [];
  const tick = state.session.currentTick;

  for (const [code, country] of Object.entries(state.countries)) {
    if (!country.intel) continue;
    const intel = country.intel;

    // Deduct intel budget
    if (intel.intelBudget > 0) {
      const cost = Math.min(intel.intelBudget, country.economy.budget);
      country.economy.budget -= cost;
    }

    // Process active spy operations
    const completedOps: string[] = [];
    for (const op of getAllSpyOps(intel)) {
      op.duration -= 1;

      // Detection check against target's counterintel
      const target = state.countries[op.targetCountry];
      if (!target) continue;
      const targetCI = target.intel?.counterIntel ?? 20;
      const detectionChance = op.detectionRisk * (1 + targetCI / 100);

      if (rng() < detectionChance) {
        // Caught!
        completedOps.push(op.id);
        country.diplomaticInfluence = Math.max(0, country.diplomaticInfluence - 5);
        events.push(makeEvent(state, tick, 'spy_caught', 'high',
          `${code} spy operation caught by ${op.targetCountry}!`,
          [code, op.targetCountry],
          { opType: op.type, spyingCountry: code }));

        // Target gets counterintel boost
        if (target.intel) {
          target.intel.counterIntel = Math.min(100, target.intel.counterIntel + 3);
        }
        continue;
      }

      // Accumulate intel points
      const dossier = getOrCreateDossier(intel, op.targetCountry);
      const config = SPY_OP_CONFIG[op.type];
      dossier.intelPoints += config.intelGain;
      dossier.lastUpdated = tick;

      // Reveal category
      if (!dossier.revealed[op.reveals]) {
        dossier.revealed[op.reveals] = true;
        events.push(makeEvent(state, tick, 'spy_success', 'medium',
          `${code} intelligence revealed ${op.reveals} data on ${op.targetCountry}`,
          [code, op.targetCountry],
          { category: op.reveals }));
      }

      // Check for level up
      const newLevel = calculateIntelLevel(dossier.intelPoints);
      if (newLevel !== dossier.level) {
        dossier.level = newLevel;
        events.push(makeEvent(state, tick, 'intel_breakthrough', 'medium',
          `${code} intel on ${op.targetCountry} upgraded to ${newLevel}`,
          [code], { level: newLevel }));
      }

      // Op completed
      if (op.duration <= 0) {
        completedOps.push(op.id);
      }
    }

    // Remove completed/caught ops
    if (completedOps.length > 0) {
      removeOps(intel, completedOps);
    }

    // Expire disinfo operations
    intel.disinfo = intel.disinfo.filter(d => {
      const remaining = d.duration - (tick - d.startedTick);
      if (remaining <= 0) return false;
      return true;
    });

    // Counterintel natural decay (very slow, encourages investment)
    if (intel.counterIntel > 20) {
      intel.counterIntel = Math.max(20, intel.counterIntel - 0.2);
    }

    // Intel decay: dossiers lose accuracy over time if no active ops
    for (const [targetCode, dossier] of Object.entries(intel.dossiers)) {
      const hasActiveOp = getAllSpyOps(intel).some(op => op.targetCountry === targetCode);
      if (!hasActiveOp && tick - dossier.lastUpdated > 6) {
        // Slow decay after 6 months of no intel gathering
        dossier.intelPoints = Math.max(0, dossier.intelPoints - 2);
        dossier.level = calculateIntelLevel(dossier.intelPoints);
      }
    }
  }

  return { events };
}

// ── Fog Engine ──
// Applies noise to a country's data based on observer's intel level + target's disinfo.

export function applyFog(
  realCountry: CountryState,
  observerIntel: IntelligenceState | undefined,
  observerCode: string,
  rng: RNG,
): CountryState {
  // You always see yourself clearly
  if (realCountry.code === observerCode) return realCountry;

  const dossier = observerIntel?.dossiers[realCountry.code];
  const level = dossier?.level ?? 'none';
  const revealed = dossier?.revealed ?? { economy: false, military: false, resources: false, diplomacy: false, stability: false };

  // Get noise factor based on intel level
  const noise = getNoiseForLevel(level);

  // Get disinfo multipliers from target
  const disinfo = realCountry.intel?.disinfo ?? [];

  // Create fogged copy
  const fogged: CountryState = JSON.parse(JSON.stringify(realCountry));

  // Apply fog to economy
  if (!revealed.economy) {
    const econDisinfo = getDisinfoMultiplier(disinfo, 'economy');
    fogged.economy.gdp = fogValue(fogged.economy.gdp, noise, econDisinfo, rng);
    fogged.economy.budget = fogValue(fogged.economy.budget, noise, econDisinfo, rng);
    fogged.economy.tradeBalance = fogValue(fogged.economy.tradeBalance, noise, econDisinfo, rng);
    fogged.economy.gdpGrowth = fogValue(fogged.economy.gdpGrowth, noise * 2, econDisinfo, rng); // growth is harder to estimate
  }

  // Apply fog to military
  if (!revealed.military) {
    const milDisinfo = getDisinfoMultiplier(disinfo, 'military');
    fogged.military.army = Math.round(fogValue(fogged.military.army, noise, milDisinfo, rng));
    fogged.military.navy = Math.round(fogValue(fogged.military.navy, noise, milDisinfo, rng));
    fogged.military.airForce = Math.round(fogValue(fogged.military.airForce, noise, milDisinfo, rng));
    fogged.military.nuclearWeapons = Math.round(fogValue(fogged.military.nuclearWeapons, noise * 0.5, milDisinfo, rng)); // nukes are more known
    fogged.military.defenseBudget = fogValue(fogged.military.defenseBudget, noise, milDisinfo, rng);
  }

  // Apply fog to resources (hide production details)
  if (!revealed.resources) {
    fogged.resourceState = {}; // completely hidden until revealed
  }

  // Apply fog to stability
  if (!revealed.stability) {
    const stabDisinfo = getDisinfoMultiplier(disinfo, 'stability');
    fogged.stability = Math.round(fogValue(fogged.stability, noise, stabDisinfo, rng));
    fogged.approval = Math.round(fogValue(fogged.approval, noise, stabDisinfo, rng));
  }

  // Recalculate power index from fogged data
  fogged.indexOfPower = fogValue(fogged.indexOfPower, noise, 1, rng);

  // Always hide intel state from other players
  fogged.intel = undefined;

  return fogged;
}

// ── Helpers ──

function fogValue(real: number, noise: number, disinfoMultiplier: number, rng: RNG): number {
  // Apply disinfo first (target's manipulation), then noise (observer's uncertainty)
  const manipulated = real * disinfoMultiplier;
  const error = manipulated * noise * (rng() * 2 - 1); // ±noise%
  return manipulated + error;
}

function getNoiseForLevel(level: IntelLevel): number {
  const map: Record<IntelLevel, number> = {
    none: 0.30,
    low: 0.20,
    medium: 0.10,
    high: 0.05,
    full: 0,
  };
  return map[level];
}

function getDisinfoMultiplier(disinfo: { category: string; multiplier: number }[], category: string): number {
  const op = disinfo.find(d => d.category === category);
  return op?.multiplier ?? 1.0;
}

function calculateIntelLevel(points: number): IntelLevel {
  if (points >= INTEL_THRESHOLDS.full) return 'full';
  if (points >= INTEL_THRESHOLDS.high) return 'high';
  if (points >= INTEL_THRESHOLDS.medium) return 'medium';
  if (points >= INTEL_THRESHOLDS.low) return 'low';
  return 'none';
}

function getOrCreateDossier(intel: IntelligenceState, targetCode: string): CountryDossier {
  if (!intel.dossiers[targetCode]) {
    intel.dossiers[targetCode] = {
      level: 'none',
      intelPoints: 0,
      activeOps: [],
      lastUpdated: 0,
      revealed: { economy: false, military: false, resources: false, diplomacy: false, stability: false },
    };
  }
  return intel.dossiers[targetCode];
}

function getAllSpyOps(intel: IntelligenceState): SpyOperation[] {
  const ops: SpyOperation[] = [];
  for (const dossier of Object.values(intel.dossiers)) {
    ops.push(...dossier.activeOps);
  }
  return ops;
}

function removeOps(intel: IntelligenceState, ids: string[]): void {
  const idSet = new Set(ids);
  for (const dossier of Object.values(intel.dossiers)) {
    dossier.activeOps = dossier.activeOps.filter(op => !idSet.has(op.id));
  }
}

let eventCounter = 0;
function makeEvent(
  state: GameState, tick: number, type: GameEvent['type'], severity: GameEvent['severity'],
  title: string, involved: string[], data: Record<string, unknown> = {},
): GameEvent {
  return {
    id: `evt-intel-${tick}-${++eventCounter}`,
    sessionId: state.session.id,
    tick, type, severity, title,
    description: title,
    involvedCountries: involved,
    data,
    createdAt: new Date().toISOString(),
  };
}
