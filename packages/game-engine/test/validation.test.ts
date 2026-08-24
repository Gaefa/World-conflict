import { describe, it, expect } from 'vitest';
import { processAction } from '../src/action-processor';
import { enqueueAction, drainActions, MAX_ACTIONS_PER_PLAYER_PER_TICK } from '../src/action-queue';
import { createRNG } from '@conflict-game/game-logic';
import { mkCountry, mkState } from './helpers';

const rng = () => createRNG(1);

function oneCountry() {
  return mkState({ countries: { AA: mkCountry({ code: 'AA' }) } });
}

describe('malformed payloads are rejected', () => {
  it('refuses a negative army size — it used to pay the player', () => {
    // recruitmentCost(size) is linear, so a negative size produced a negative
    // cost and `budget -= cost` handed out free money.
    const state = oneCountry();
    const before = state.countries.AA.economy.budget;

    const res = processAction(state, 'AA', {
      type: 'create_army', armyType: 'infantry', size: -1_000_000,
      name: 'Exploit', latitude: 0, longitude: 0,
    }, rng());

    expect(res.success).toBe(false);
    expect(state.countries.AA.economy.budget).toBe(before);
    expect(state.armies).toHaveLength(0);
  });

  it('caps army size so one order cannot conjure an infinite host', () => {
    const state = oneCountry();
    const res = processAction(state, 'AA', {
      type: 'create_army', armyType: 'infantry', size: 50_000_000,
      name: 'Horde', latitude: 0, longitude: 0,
    }, rng());
    expect(res.success).toBe(false);
  });

  it('rejects NaN and Infinity anywhere in the payload', () => {
    const state = oneCountry();
    for (const bad of [NaN, Infinity, -Infinity]) {
      const res = processAction(state, 'AA', {
        type: 'allocate_budget', category: 'economy', amount: bad,
      }, rng());
      expect(res.success, `${bad} was accepted`).toBe(false);
    }
    expect(state.countries.AA.economy.budget).toBe(100);
  });

  it('clamps coordinates to the globe', () => {
    const state = oneCountry();
    const res = processAction(state, 'AA', {
      type: 'create_army', armyType: 'infantry', size: 1000,
      name: 'Nowhere', latitude: 500, longitude: 9999,
    }, rng());
    expect(res.success).toBe(false);
  });

  it('keeps invasion commitment inside 0..1', () => {
    const state = mkState({
      countries: { AA: mkCountry({ code: 'AA' }), BB: mkCountry({ code: 'BB' }) },
    });
    const res = processAction(state, 'AA', {
      type: 'invasion', targetCountry: 'BB', committedForces: 50,
    }, rng());
    expect(res.success).toBe(false);
  });

  it('still lets a well-formed action through', () => {
    const state = oneCountry();
    const res = processAction(state, 'AA', {
      type: 'create_army', armyType: 'infantry', size: 10_000,
      name: 'Division', latitude: 10, longitude: 20,
    }, rng());
    expect(res.success).toBe(true);
    expect(state.armies).toHaveLength(1);
  });
});

describe('per-player action rate limit', () => {
  it('accepts up to the cap and refuses the rest', () => {
    const sid = 'rate-test';
    drainActions(sid); // start clean
    const item = { playerId: 'p1', countryCode: 'AA', sessionId: sid, action: { type: 'ping' } as never };

    for (let i = 0; i < MAX_ACTIONS_PER_PLAYER_PER_TICK; i++) {
      expect(enqueueAction(sid, item), `action ${i} rejected`).toBe(true);
    }
    expect(enqueueAction(sid, item)).toBe(false);
    expect(drainActions(sid)).toHaveLength(MAX_ACTIONS_PER_PLAYER_PER_TICK);
  });

  it('budgets each player separately', () => {
    const sid = 'rate-test-2';
    drainActions(sid);
    const mk = (playerId: string) => ({ playerId, countryCode: 'AA', sessionId: sid, action: { type: 'ping' } as never });

    for (let i = 0; i < MAX_ACTIONS_PER_PLAYER_PER_TICK; i++) enqueueAction(sid, mk('p1'));
    expect(enqueueAction(sid, mk('p1'))).toBe(false);
    expect(enqueueAction(sid, mk('p2'))).toBe(true);
  });

  it('refills the budget once the tick drains the queue', () => {
    const sid = 'rate-test-3';
    drainActions(sid);
    const item = { playerId: 'p1', countryCode: 'AA', sessionId: sid, action: { type: 'ping' } as never };

    for (let i = 0; i < MAX_ACTIONS_PER_PLAYER_PER_TICK; i++) enqueueAction(sid, item);
    expect(enqueueAction(sid, item)).toBe(false);

    drainActions(sid);
    expect(enqueueAction(sid, item)).toBe(true);
  });
});
