import { describe, it, expect } from 'vitest';
import { runTick } from '../src/tick';
import { createRNG } from '@conflict-game/game-logic';
import { mkCountry, mkState } from './helpers';

function rel(id: string, status: string, createdAtTick: number, type = 'trade_agreement') {
  return {
    id, sessionId: 's', type, status,
    fromCountry: 'AA', toCountry: 'BB', createdAtTick, expiresAtTick: null,
  } as never;
}

function advance(state: ReturnType<typeof mkState>, ticks: number) {
  const rng = createRNG(5);
  for (let i = 0; i < ticks; i++) {
    runTick({ state, sessionId: 's', queuedActions: [], rng });
  }
}

describe('relation lifecycle', () => {
  it('expires proposals nobody answered', () => {
    const state = mkState({
      countries: { AA: mkCountry(), BB: mkCountry() },
      relations: [rel('p1', 'proposed', 0)],
    });
    advance(state, 16); // threshold is 15 ticks
    expect(state.relations.find(r => r.id === 'p1')?.status).toBe('expired');
  });

  it('prunes long-dead relations so the array cannot grow forever', () => {
    const state = mkState({
      countries: { AA: mkCountry(), BB: mkCountry() },
      relations: [rel('dead', 'rejected', 0), rel('alive', 'active', 0, 'alliance')],
    });
    advance(state, 9);
    // Corpses survive a while so clients still see the status transition
    expect(state.relations.some(r => r.id === 'dead')).toBe(true);

    advance(state, 31);
    expect(state.relations.some(r => r.id === 'dead')).toBe(false);
    expect(state.relations.some(r => r.id === 'alive')).toBe(true);
  });
});

describe('tick bookkeeping', () => {
  it('advances the clock and recomputes power', () => {
    const state = mkState({ countries: { AA: mkCountry({ indexOfPower: 0 }) } });
    advance(state, 3);
    expect(state.session.currentTick).toBe(3);
    expect(state.countries.AA.indexOfPower).toBeGreaterThan(0);
  });

  it('raises global tension while a war runs', () => {
    const peace = mkState({ countries: { AA: mkCountry(), BB: mkCountry() } });
    advance(peace, 2);

    const wartime = mkState({
      countries: { AA: mkCountry(), BB: mkCountry() },
      relations: [rel('w', 'active', 0, 'war')],
    });
    advance(wartime, 2);

    expect(wartime.tensionIndex).toBeGreaterThan(peace.tensionIndex);
  });
});
