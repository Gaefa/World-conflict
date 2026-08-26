import { describe, it, expect } from 'vitest';
import { deriveGameData } from '../src/lib/deriveGameData';
import { mkCountry, mkState } from '../../../packages/game-logic/test/helpers';
import type { CountryData } from '@conflict-game/shared-types';

/**
 * deriveGameData feeds the globe colouring, the leaderboard and — via
 * warCountries → warEnemies — the action panel's war banner and its
 * war-only cards. One wrong filter here silently mislabels the whole map.
 */

const seed = [
  { code: 'DE', name: 'Germany', flag: '🇩🇪', latitude: 52, longitude: 13, population: 8e7, startingState: mkCountry() },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', latitude: 52, longitude: 21, population: 4e7, startingState: mkCountry() },
  { code: 'FR', name: 'France', flag: '🇫🇷', latitude: 48, longitude: 2, population: 6e7, startingState: mkCountry() },
] as unknown as CountryData[];

function rel(type: string, from: string, to: string, status = 'active') {
  return { id: `${type}-${from}-${to}`, sessionId: 's', type, status, fromCountry: from, toCountry: to, createdAtTick: 0, expiresAtTick: null } as never;
}

function world(relations: unknown[] = []) {
  return mkState({
    countries: { DE: mkCountry({ code: 'DE' }), PL: mkCountry({ code: 'PL' }), FR: mkCountry({ code: 'FR' }) },
    players: [{ id: 'p1', name: 'T', countryCode: 'DE', isAI: false, isOnline: true }] as never,
    relations: relations as never,
  });
}

const derive = (relations: unknown[] = []) =>
  deriveGameData(world(relations), 'p1', seed, null, '');

describe('relation sets', () => {
  it('lists only the player’s own active wars', () => {
    const d = derive([
      rel('war', 'DE', 'PL'),
      rel('war', 'FR', 'PL'),            // someone else's war
      rel('war', 'DE', 'FR', 'expired'), // ours, but over
    ]);
    expect([...d.warCountries]).toEqual(['PL']);
  });

  it('sees a war regardless of which side declared it', () => {
    expect([...derive([rel('war', 'PL', 'DE')]).warCountries]).toEqual(['PL']);
  });

  it('separates allies and sanctions from wars', () => {
    const d = derive([
      rel('alliance', 'DE', 'FR'),
      rel('sanction', 'DE', 'PL'),
    ]);
    expect([...d.allyCountries]).toEqual(['FR']);
    expect([...d.sanctionedCountries]).toEqual(['PL']);
    expect(d.warCountries.size).toBe(0);
  });

  it('counts only sanctions the player imposed, not ones against them', () => {
    const d = derive([rel('sanction', 'PL', 'DE')]);
    expect(d.sanctionedCountries.size).toBe(0);
  });
});

describe('player identity', () => {
  it('resolves the player country and country names', () => {
    const d = derive();
    expect(d.playerCountryCode).toBe('DE');
    expect(d.countryNames.PL).toBe('Poland');
  });

  it('marks the player in the leaderboard exactly once', () => {
    const d = derive();
    expect(d.leaderboardEntries.filter(e => e.isPlayer).map(e => e.code)).toEqual(['DE']);
  });
});
