import { describe, it, expect } from 'vitest';
import { processMilitaryTick } from '../src/military/military-tick';
import { createRNG } from '../src/rng';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import { mkCountry, mkArmy, mkState, war } from './helpers';

const RU = SEED_COUNTRIES.find(c => c.code === 'RU')!;
const rng = () => createRNG(7);

describe('army movement', () => {
  it('advances toward the target and stops on arrival', () => {
    const state = mkState({
      countries: { AA: mkCountry() },
      armies: [mkArmy({ latitude: 0, longitude: 0, targetLatitude: 0, targetLongitude: 10, status: 'moving' })],
    });
    state.session.currentTick = 1;
    processMilitaryTick(state, rng());
    // infantry moves 4°/tick
    expect(state.armies[0].longitude).toBeCloseTo(4, 5);
    expect(state.armies[0].status).toBe('moving');

    for (let t = 2; t <= 4; t++) {
      state.session.currentTick = t;
      processMilitaryTick(state, rng());
    }
    expect(state.armies[0].longitude).toBeCloseTo(10, 5);
    expect(state.armies[0].status).toBe('idle');
    expect(state.armies[0].targetLatitude).toBeNull();
  });

  it('takes the short way across the antimeridian', () => {
    const state = mkState({
      countries: { AA: mkCountry() },
      armies: [mkArmy({ latitude: 0, longitude: 178, targetLatitude: 0, targetLongitude: -178, status: 'moving' })],
    });
    state.session.currentTick = 1;
    processMilitaryTick(state, rng());
    // 4° east of 178 wraps to -178, not a 356° trip back west
    expect(state.armies[0].longitude).toBeCloseTo(-178, 5);
  });
});

describe('battles', () => {
  it('inflicts losses on both sides when enemies meet', () => {
    const state = mkState({
      countries: { AA: mkCountry(), BB: mkCountry() },
      relations: [war('AA', 'BB')],
      armies: [
        mkArmy({ id: 'a', ownerCountry: 'AA', latitude: 0, longitude: 0, status: 'moving' }),
        mkArmy({ id: 'b', ownerCountry: 'BB', latitude: 0, longitude: 1, size: 15_000 }),
      ],
    });
    state.session.currentTick = 1;
    const { events } = processMilitaryTick(state, rng());

    expect(state.armies.find(a => a.id === 'a')!.size).toBeLessThan(20_000);
    expect(state.armies.find(a => a.id === 'b')!.size).toBeLessThan(15_000);
    expect(events.some(e => e.type === 'battle_result')).toBe(true);
  });

  it('leaves armies of countries at peace alone', () => {
    const state = mkState({
      countries: { AA: mkCountry(), BB: mkCountry() },
      relations: [], // no war
      armies: [
        mkArmy({ id: 'a', ownerCountry: 'AA', latitude: 0, longitude: 0 }),
        mkArmy({ id: 'b', ownerCountry: 'BB', latitude: 0, longitude: 1 }),
      ],
    });
    state.session.currentTick = 1;
    processMilitaryTick(state, rng());
    expect(state.armies.every(a => a.size === 20_000)).toBe(true);
  });

  it('removes armies that fall below the survival threshold', () => {
    const state = mkState({
      countries: { AA: mkCountry() },
      armies: [mkArmy({ size: 50 })], // under MIN_SIZE (100)
    });
    state.session.currentTick = 1;
    const { events } = processMilitaryTick(state, rng());
    expect(state.armies).toHaveLength(0);
    expect(events.some(e => (e.data as { destroyedArmy?: string }).destroyedArmy)).toBe(true);
  });
});

describe('occupation → capitulation', () => {
  function occupiedState() {
    return mkState({
      countries: { AA: mkCountry(), RU: mkCountry() },
      relations: [war('AA', 'RU')],
      armies: [mkArmy({
        ownerCountry: 'AA', latitude: RU.latitude, longitude: RU.longitude, size: 30_000,
      })],
    });
  }

  it('bleeds an undefended capital each tick', () => {
    const state = occupiedState();
    const before = state.countries.RU.stability;
    state.session.currentTick = 1;
    processMilitaryTick(state, rng());
    expect(state.countries.RU.stability).toBe(before - 4);
    expect(state.countries.RU.economy.gdp).toBeLessThan(1000);
  });

  it('does not apply pressure while a defender holds the capital', () => {
    const state = occupiedState();
    state.armies.push(mkArmy({
      id: 'def', ownerCountry: 'RU', latitude: RU.latitude, longitude: RU.longitude,
    }));
    const before = state.countries.RU.stability;
    state.session.currentTick = 1;
    processMilitaryTick(state, rng());
    // Stability may move from battle losses, but not by the occupation −4
    expect(state.countries.RU.stability).toBeGreaterThanOrEqual(before - 2);
  });

  it('ends the war and pays spoils once stability collapses', () => {
    const state = occupiedState();
    state.countries.RU.stability = 10; // one tick from the ≤8 threshold
    const attackerGdpBefore = state.countries.AA.economy.gdp;

    state.session.currentTick = 1;
    const { events } = processMilitaryTick(state, rng());

    expect(state.relations[0].status).toBe('expired');
    expect(state.countries.AA.economy.gdp).toBeGreaterThan(attackerGdpBefore);
    const cap = events.find(e => (e.data as { capitulation?: boolean }).capitulation);
    expect(cap).toBeDefined();
    expect((cap!.data as { victor: string }).victor).toBe('AA');
  });
});

describe('upkeep', () => {
  it('charges maintenance to the owner budget', () => {
    const state = mkState({
      countries: { AA: mkCountry() },
      armies: [mkArmy({ ownerCountry: 'AA' })],
    });
    state.session.currentTick = 1;
    processMilitaryTick(state, rng());
    expect(state.countries.AA.economy.budget).toBeLessThan(100);
  });

  it('drains morale when the treasury is empty', () => {
    const state = mkState({
      countries: { AA: mkCountry({ economy: { ...mkCountry().economy, budget: -5 } }) },
      armies: [mkArmy({ ownerCountry: 'AA', morale: 50 })],
    });
    state.session.currentTick = 1;
    processMilitaryTick(state, rng());
    expect(state.armies[0].morale).toBe(47);
  });
});
