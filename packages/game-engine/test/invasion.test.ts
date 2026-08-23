import { describe, it, expect } from 'vitest';
import { processAction } from '../src/action-processor';
import { createRNG } from '@conflict-game/game-logic';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import { mkCountry, mkState, war } from './helpers';

const DE = SEED_COUNTRIES.find(c => c.code === 'DE')!;

function twoCountriesAtWar() {
  return mkState({
    countries: { DE: mkCountry({ code: 'DE' }), PL: mkCountry({ code: 'PL', military: { ...mkCountry().military, army: 40_000 } }) },
    relations: [war('DE', 'PL')],
  });
}

describe('invasion', () => {
  it('detaches troops from the reserve into a marching army', () => {
    const state = twoCountriesAtWar();
    const res = processAction(state, 'DE', { type: 'invasion', targetCountry: 'PL', committedForces: 0.5 }, createRNG(1));

    expect(res.success).toBe(true);
    expect(state.countries.DE.military.army).toBe(50_000); // 100k − 50%
    expect(state.armies).toHaveLength(1);

    const force = state.armies[0];
    expect(force.ownerCountry).toBe('DE');
    expect(force.size).toBe(50_000);
    expect(force.status).toBe('moving');
    // Spawns at home, heads for the enemy capital
    expect(force.latitude).toBeCloseTo(DE.latitude, 5);
    expect(force.targetLatitude).not.toBeNull();
  });

  it('charges stability at home — war is not free', () => {
    const state = twoCountriesAtWar();
    processAction(state, 'DE', { type: 'invasion', targetCountry: 'PL', committedForces: 0.5 }, createRNG(1));
    expect(state.countries.DE.stability).toBe(56); // 60 − 4
  });

  it('resolves no battle on its own — that is the military tick job', () => {
    const state = twoCountriesAtWar();
    processAction(state, 'DE', { type: 'invasion', targetCountry: 'PL', committedForces: 0.5 }, createRNG(1));
    // The defender is untouched until the force actually arrives
    expect(state.countries.PL.military.army).toBe(40_000);
  });

  it('refuses an invasion the country cannot man', () => {
    const state = twoCountriesAtWar();
    state.countries.DE.military.army = 100;
    const res = processAction(state, 'DE', { type: 'invasion', targetCountry: 'PL', committedForces: 0.5 }, createRNG(1));
    expect(res.success).toBe(false);
    expect(state.armies).toHaveLength(0);
  });

  it('costs influence and approval when declared without a war', () => {
    const state = mkState({
      countries: { DE: mkCountry({ code: 'DE' }), PL: mkCountry({ code: 'PL' }) },
      relations: [],
    });
    processAction(state, 'DE', { type: 'invasion', targetCountry: 'PL', committedForces: 0.3 }, createRNG(1));
    expect(state.countries.DE.diplomaticInfluence).toBe(25); // 50 − 25
    expect(state.countries.DE.approval).toBe(45);            // 60 − 15 (stability is charged separately)
  });
});
