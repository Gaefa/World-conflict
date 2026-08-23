import { describe, it, expect } from 'vitest';
import { checkVictoryConditions } from '../src/victory/index';
import { mkCountry, mkState } from './helpers';

/** Countries whose Index of Power we control directly. */
function withPowers(powers: Record<string, number>, extra: Record<string, Partial<ReturnType<typeof mkCountry>>> = {}) {
  const countries: Record<string, ReturnType<typeof mkCountry>> = {};
  for (const [code, iop] of Object.entries(powers)) {
    countries[code] = mkCountry({ code, indexOfPower: iop, ...(extra[code] ?? {}) });
  }
  return mkState({ countries });
}

describe('victory conditions', () => {
  it('declares domination for a runaway leader', () => {
    const state = withPowers({ AA: 85, BB: 40, CC: 30 });
    const r = checkVictoryConditions(state);
    expect(r.achieved).toBe(true);
    expect(r.winner).toBe('AA');
    expect(r.condition).toBe('domination');
  });

  it('does not declare domination when the runner-up is close', () => {
    // 85 clears the 80 bar but is not 1.5x the second place (70).
    // Four countries keep every GDP share under the 40% economic bar.
    const state = withPowers({ AA: 85, BB: 70, CC: 30, DD: 20 });
    expect(checkVictoryConditions(state).condition).not.toBe('domination');
  });

  it('declares economic hegemony above 40% of world GDP', () => {
    const state = withPowers({ AA: 50, BB: 50, CC: 50 });
    state.countries.AA.economy.gdp = 9000; // 9000 / 11000 > 40%
    state.countries.BB.economy.gdp = 1000;
    state.countries.CC.economy.gdp = 1000;
    const r = checkVictoryConditions(state);
    expect(r.achieved).toBe(true);
    expect(r.condition).toBe('economic_hegemony');
  });

  it('declares a technological win at 30 researched techs', () => {
    // Four countries so no one trips the economic condition first.
    const state = withPowers({ AA: 50, BB: 50, CC: 50, DD: 50 });
    state.countries.AA.tech = {
      researchedTechs: Array.from({ length: 30 }, (_, i) => `t${i}`),
      activeResearch: null,
      bonuses: {} as never,
    };
    const r = checkVictoryConditions(state);
    expect(r.achieved).toBe(true);
    expect(r.condition).toBe('technological');
  });

  it('finds no winner in a balanced world', () => {
    const state = withPowers({ AA: 50, BB: 48, CC: 46, DD: 44 });
    expect(checkVictoryConditions(state).achieved).toBe(false);
  });
});
