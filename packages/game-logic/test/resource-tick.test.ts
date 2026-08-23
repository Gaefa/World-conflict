import { describe, it, expect } from 'vitest';
import { processResourceTick } from '../src/resources/resource-tick';
import { createRNG } from '../src/rng';
import { mkCountry, mkState } from './helpers';

describe('resource tick', () => {
  it('does not compound consumption across ticks', () => {
    // Regression: Step 3 used to overwrite Step 2's additive processing
    // demand; a later fix reset consumption in Step 1. Without that reset,
    // consumption grows every tick even with static inputs.
    const state = mkState({
      countries: { AA: mkCountry({ resources: { oil: 60 } as never }) },
    });
    const rng = createRNG(3);

    state.session.currentTick = 1;
    processResourceTick(state, rng);
    const first = state.countries.AA.resourceState!.oil!.consumption;

    for (let t = 2; t <= 6; t++) {
      state.session.currentTick = t;
      processResourceTick(state, rng);
    }
    const later = state.countries.AA.resourceState!.oil!.consumption;

    expect(later).toBeCloseTo(first, 6);
  });

  it('produces from capacity and records a deficit when demand exceeds it', () => {
    const state = mkState({
      countries: { AA: mkCountry({ resources: { oil: 0, wheat: 100 } as never }) },
    });
    state.session.currentTick = 1;
    processResourceTick(state, createRNG(3));

    const oil = state.countries.AA.resourceState!.oil!;
    const wheat = state.countries.AA.resourceState!.wheat!;

    expect(oil.production).toBe(0);
    expect(oil.deficit).toBeGreaterThan(0);   // consumed but not produced
    expect(wheat.production).toBe(50);        // capacity 100 → 50 units/tick
  });

  it('keeps a market price for every traded resource', () => {
    const state = mkState({ countries: { AA: mkCountry({ resources: { oil: 50 } as never }) } });
    state.session.currentTick = 1;
    const { resourceMarket } = processResourceTick(state, createRNG(3));
    expect(Object.keys(resourceMarket.prices).length).toBeGreaterThan(0);
    expect(resourceMarket.prices.oil).toBeGreaterThan(0);
  });
});
