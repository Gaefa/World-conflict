import { describe, it, expect } from 'vitest';
import { calculateIndexOfPower } from '../src/power-index';
import { mkCountry } from './helpers';

describe('index of power', () => {
  it('stays within 0..100', () => {
    const tiny = calculateIndexOfPower(mkCountry({
      economy: { ...mkCountry().economy, gdp: 1 },
      military: { ...mkCountry().military, army: 0, navy: 0, airForce: 0, nuclearWeapons: 0, techLevel: 1 },
      stability: 0, diplomaticInfluence: 0, techLevel: 1,
    }));
    const huge = calculateIndexOfPower(mkCountry({
      economy: { ...mkCountry().economy, gdp: 999_999 },
      military: { ...mkCountry().military, army: 9_000_000, navy: 900, airForce: 9000, nuclearWeapons: 9000, techLevel: 10 },
      stability: 100, diplomaticInfluence: 100, techLevel: 10,
    }));
    expect(tiny).toBeGreaterThanOrEqual(0);
    expect(huge).toBeLessThanOrEqual(100);
    expect(huge).toBeGreaterThan(tiny);
  });

  it('rises when GDP rises, all else equal', () => {
    const poor = calculateIndexOfPower(mkCountry({ economy: { ...mkCountry().economy, gdp: 500 } }));
    const rich = calculateIndexOfPower(mkCountry({ economy: { ...mkCountry().economy, gdp: 15_000 } }));
    expect(rich).toBeGreaterThan(poor);
  });
});
