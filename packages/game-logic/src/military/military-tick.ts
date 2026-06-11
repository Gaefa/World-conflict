import type { Army, GameState, GameEvent } from '@conflict-game/shared-types';
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

/** Army is destroyed when it falls below these thresholds. */
const MIN_SIZE = 100;
const MIN_MORALE = 10;

export interface MilitaryTickResult {
  events: GameEvent[];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Approximate distance in degrees, with longitude shrink by latitude. */
function armyDistance(a: Army, b: Army): number {
  const dLat = a.latitude - b.latitude;
  let dLng = Math.abs(a.longitude - b.longitude);
  if (dLng > 180) dLng = 360 - dLng; // antimeridian
  dLng *= Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLng * dLng);
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

  return { events };
}
