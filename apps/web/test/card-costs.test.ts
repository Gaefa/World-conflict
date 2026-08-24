import { describe, it, expect } from 'vitest';
import { CARDS } from '../src/lib/cards';
import { processAction } from '../../../packages/game-engine/src/action-processor';
import { createRNG } from '@conflict-game/game-logic';
import { TECH_TREE } from '@conflict-game/shared-types';
import { mkCountry, mkState } from '../../../packages/game-logic/test/helpers';

/**
 * cards.json declares each action's price by hand so balance stays editable
 * without touching TypeScript. Nothing stopped those numbers from drifting
 * away from the engine's own formulas — this checks them behaviourally
 * instead of duplicating the maths: with exactly the declared budget the
 * engine must accept the action, and a hair under it must refuse for lack
 * of funds.
 */

const ALL_TECHS = Object.keys(TECH_TREE);

/** A country that satisfies every non-budget requirement in the catalogue. */
function tycoon(budget: number) {
  return mkCountry({
    code: 'DE',
    economy: { ...mkCountry().economy, gdp: 2000, budget },
    military: { army: 500_000, navy: 100, airForce: 500, nuclearWeapons: 10, techLevel: 9, defenseBudget: 100 },
    diplomaticInfluence: 100, techLevel: 9,
    resources: { oil: 100 } as never,
    resourceState: { oil: { production: 50, consumption: 5, imported: 0, exported: 0, smuggled: 0, deficit: 0, stockpile: 0 } } as never,
    tech: { researchedTechs: ALL_TECHS, activeResearch: null, bonuses: {} } as never,
    intel: { intelBudget: 5, counterIntel: 50, disinfo: [], sigintActive: false, dossiers: {} } as never,
  });
}

function worldWith(budget: number) {
  return mkState({
    countries: { DE: tycoon(budget), PL: mkCountry({ code: 'PL' }) },
    relations: [],
  });
}

// Research prices come from the tech tree at runtime, and the "all techs
// researched" country has nothing left to study — priced elsewhere.
const priced = CARDS.filter(c => c.budgetCost && !c.id.startsWith('research_'));

describe('card prices match what the engine charges', () => {
  it.each(priced.map(c => [c.id] as const))('%s is affordable at exactly its listed price', (id) => {
    const card = CARDS.find(c => c.id === id)!;
    const cost = card.budgetCost!(tycoon(0));
    if (cost <= 0) return; // free actions have nothing to verify

    const state = worldWith(cost);
    const action = card.build({ target: 'PL', country: state.countries.DE, home: { lat: 0, lng: 0 }, warEnemies: ['PL'] });
    expect(action, `${id} built no action`).not.toBeNull();

    const res = processAction(state, 'DE', action!, createRNG(1));
    expect(res.success, `${id} rejected at its listed price: ${res.message}`).toBe(true);
  });

  it.each(priced.map(c => [c.id] as const))('%s is refused just under its listed price', (id) => {
    const card = CARDS.find(c => c.id === id)!;
    const cost = card.budgetCost!(tycoon(0));
    if (cost <= 0.5) return; // too cheap to probe below

    const state = worldWith(cost - 0.5);
    const action = card.build({ target: 'PL', country: state.countries.DE, home: { lat: 0, lng: 0 }, warEnemies: ['PL'] });
    const res = processAction(state, 'DE', action!, createRNG(1));

    expect(res.success, `${id} succeeded below its listed price — the card is overcharging`).toBe(false);
    expect(res.message.toLowerCase()).toMatch(/budget|insufficient|need/);
  });
});
