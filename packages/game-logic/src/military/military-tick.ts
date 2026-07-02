import type { Army, GameState, GameEvent } from '@conflict-game/shared-types';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import type { RNG } from '../rng';
import { resolveBattle, maintenanceCost } from './index';

/** Movement speed in degrees per tick, by army type. */
const MOVE_SPEED: Record<string, number> = {
  infantry: 4,
  armored: 6,
  naval: 6,
  airforce: 15,
  special_ops: 8,
};

/** Armies of warring countries within this distance (degrees) engage. */
const BATTLE_RANGE = 3;

/** An army within this distance of an enemy capital occupies it. */
const OCCUPY_RANGE = 6;

/** Occupied country capitulates once its stability falls to this. */
const CAPITULATE_STABILITY = 8;

/** Army is destroyed when it falls below these thresholds. */
const MIN_SIZE = 100;
const MIN_MORALE = 10;

/** Capital coordinates by country code (each country's home lat/lng). */
const CAPITAL: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  SEED_COUNTRIES.map(c => [c.code, { lat: c.latitude, lng: c.longitude }]),
);

export interface MilitaryTickResult {
  events: GameEvent[];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Approximate distance in degrees between two points, longitude shrunk by latitude. */
function pointDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  let dLng = Math.abs(lng1 - lng2);
  if (dLng > 180) dLng = 360 - dLng; // antimeridian
  dLng *= Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function armyDistance(a: Army, b: Army): number {
  return pointDistance(a.latitude, a.longitude, b.latitude, b.longitude);
}

function atWar(state: GameState, c1: string, c2: string): boolean {
  return state.relations.some(
    r => r.type === 'war' && r.status === 'active' &&
    ((r.fromCountry === c1 && r.toCountry === c2) || (r.fromCountry === c2 && r.toCountry === c1))
  );
}

let _milEvtSeq = 0;

function makeEvent(
  state: GameState, type: GameEvent['type'], severity: GameEvent['severity'],
  title: string, description: string, involved: string[],
  data: Record<string, unknown>,
): GameEvent {
  return {
    id: `evt-mil-${involved.join('-')}-${state.session.currentTick}-${++_milEvtSeq}`,
    sessionId: state.session.id,
    type, title, description, severity,
    involvedCountries: involved,
    tick: state.session.currentTick,
    data,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Per-tick army processing: maintenance, movement, battles.
 * Mutates state.armies (movement, losses, removal) and owner countries
 * (budget, stability). Returns battle events.
 */
export function processMilitaryTick(state: GameState, rng: RNG): MilitaryTickResult {
  const events: GameEvent[] = [];
  if (!state.armies || state.armies.length === 0) return { events };

  // ── 1. Maintenance + morale recovery ──
  for (const army of state.armies) {
    const owner = state.countries[army.ownerCountry];
    if (owner) {
      owner.economy.budget -= maintenanceCost(army);
      // Unpaid armies lose morale; otherwise idle armies slowly recover
      if (owner.economy.budget < 0) {
        army.morale = clamp(army.morale - 3, 0, 100);
      } else if (army.status === 'idle' && army.morale < 80) {
        army.morale = clamp(army.morale + 2, 0, 100);
      }
    }
  }

  // ── 2. Movement ──
  for (const army of state.armies) {
    if (army.status !== 'moving' || army.targetLatitude === null || army.targetLongitude === null) continue;

    const speed = MOVE_SPEED[army.type] ?? 4;
    const dLat = army.targetLatitude - army.latitude;
    let dLng = army.targetLongitude - army.longitude;
    // Take the short way around the antimeridian
    if (dLng > 180) dLng -= 360;
    if (dLng < -180) dLng += 360;

    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist <= speed) {
      army.latitude = army.targetLatitude;
      army.longitude = army.targetLongitude;
      army.targetLatitude = null;
      army.targetLongitude = null;
      army.status = 'idle';
    } else {
      army.latitude += (dLat / dist) * speed;
      army.longitude += (dLng / dist) * speed;
      if (army.longitude > 180) army.longitude -= 360;
      if (army.longitude < -180) army.longitude += 360;
    }
  }

  // ── 3. Battles: each army engages the nearest enemy in range, once per tick ──
  const fought = new Set<string>();
  for (const army of state.armies) {
    if (fought.has(army.id) || army.size <= 0) continue;

    let nearest: Army | null = null;
    let nearestDist = Infinity;
    for (const other of state.armies) {
      if (other.id === army.id || fought.has(other.id) || other.size <= 0) continue;
      if (other.ownerCountry === army.ownerCountry) continue;
      if (!atWar(state, army.ownerCountry, other.ownerCountry)) continue;
      const d = armyDistance(army, other);
      if (d <= BATTLE_RANGE && d < nearestDist) {
        nearest = other;
        nearestDist = d;
      }
    }
    if (!nearest) continue;

    // The side that was advancing is the attacker; defender gets the terrain bonus.
    const armyIsAttacker = army.status === 'moving' || army.status === 'attacking' || nearest.status === 'defending';
    const attacker = armyIsAttacker ? army : nearest;
    const defender = armyIsAttacker ? nearest : army;

    const result = resolveBattle(attacker, defender, rng);
    attacker.size = Math.max(0, attacker.size - result.attackerLosses);
    defender.size = Math.max(0, defender.size - result.defenderLosses);
    attacker.morale = clamp(attacker.morale + result.attackerMoraleChange, 0, 100);
    defender.morale = clamp(defender.morale + result.defenderMoraleChange, 0, 100);
    attacker.experience = clamp(attacker.experience + 5, 0, 100);
    defender.experience = clamp(defender.experience + 5, 0, 100);
    attacker.status = 'attacking';
    defender.status = 'defending';
    fought.add(attacker.id);
    fought.add(defender.id);

    // Country-level fallout
    const winnerCode = result.attackerWins ? attacker.ownerCountry : defender.ownerCountry;
    const loserCode = result.attackerWins ? defender.ownerCountry : attacker.ownerCountry;
    const winner = state.countries[winnerCode];
    const loser = state.countries[loserCode];
    if (winner) winner.approval = clamp(winner.approval + 1, 0, 100);
    if (loser) loser.stability = clamp(loser.stability - 2, 0, 100);

    events.push(makeEvent(
      state, 'battle_result', 'high',
      `Battle: ${attacker.name} vs ${defender.name}`,
      `${winnerCode} won the engagement. Losses — ${attacker.ownerCountry}: ${result.attackerLosses}, ${defender.ownerCountry}: ${result.defenderLosses}.`,
      [attacker.ownerCountry, defender.ownerCountry],
      {
        winner: winnerCode,
        attackerLosses: result.attackerLosses,
        defenderLosses: result.defenderLosses,
        attackerArmy: attacker.name,
        defenderArmy: defender.name,
      },
    ));
  }

  // ── 4. Remove destroyed / routed armies ──
  const destroyed = state.armies.filter(a => a.size < MIN_SIZE || a.morale <= MIN_MORALE);
  if (destroyed.length > 0) {
    for (const army of destroyed) {
      events.push(makeEvent(
        state, 'battle_result', 'medium',
        `${army.name} destroyed`,
        `${army.ownerCountry}'s ${army.name} has been wiped out or routed.`,
        [army.ownerCountry],
        { destroyedArmy: army.name, owner: army.ownerCountry },
      ));
    }
    state.armies = state.armies.filter(a => a.size >= MIN_SIZE && a.morale > MIN_MORALE);
  }

  // ── 5. Occupation: an army holding an undefended enemy capital pressures
  //        that country until it capitulates, ending the war militarily. ──
  const occupiedThisTick = new Set<string>(); // one pressure application per country/tick
  for (const army of state.armies) {
    if (army.size <= 0) continue;

    for (const rel of state.relations) {
      if (rel.type !== 'war' || rel.status !== 'active') continue;
      const enemy = rel.fromCountry === army.ownerCountry ? rel.toCountry
        : rel.toCountry === army.ownerCountry ? rel.fromCountry : null;
      if (!enemy || occupiedThisTick.has(enemy)) continue;

      const cap = CAPITAL[enemy];
      if (!cap || pointDistance(army.latitude, army.longitude, cap.lat, cap.lng) > OCCUPY_RANGE) continue;

      // The capital is defended if the enemy has a surviving army near it.
      const defended = state.armies.some(a =>
        a.ownerCountry === enemy && a.size > 0 &&
        pointDistance(a.latitude, a.longitude, cap.lat, cap.lng) <= OCCUPY_RANGE,
      );
      if (defended) continue;

      const target = state.countries[enemy];
      const occupier = state.countries[army.ownerCountry];
      if (!target) continue;
      occupiedThisTick.add(enemy);

      // Occupation pressure
      target.stability = clamp(target.stability - 4, 0, 100);
      target.approval = clamp(target.approval - 3, 0, 100);
      target.economy.gdp *= 0.98; // 2%/tick bleed under occupation
      if (occupier) occupier.approval = clamp(occupier.approval + 1, 0, 100);

      if (target.stability <= CAPITULATE_STABILITY) {
        // Capitulation — war ends, occupier takes spoils
        rel.status = 'expired';
        const spoils = target.economy.gdp * 0.15;
        target.economy.gdp -= spoils;
        target.stability = clamp(target.stability + 20, 0, 100); // post-war floor
        if (occupier) occupier.economy.gdp += spoils;
        events.push(makeEvent(
          state, 'battle_result', 'critical',
          `${enemy} capitulates to ${army.ownerCountry}`,
          `${army.ownerCountry} occupied ${enemy}'s capital. ${enemy} has capitulated — the war is over.`,
          [army.ownerCountry, enemy],
          { capitulation: true, victor: army.ownerCountry, loser: enemy, spoils: Math.round(spoils) },
        ));
      } else if (state.session.currentTick % 3 === 0) {
        // Throttle ongoing-occupation notices to every 3 ticks
        events.push(makeEvent(
          state, 'military_incident', 'high',
          `${army.ownerCountry} occupies ${enemy}'s capital`,
          `${army.ownerCountry}'s forces hold ${enemy}'s capital region — its stability is collapsing.`,
          [army.ownerCountry, enemy],
          { occupation: true, occupier: army.ownerCountry, occupied: enemy },
        ));
      }
    }
  }

  return { events };
}
