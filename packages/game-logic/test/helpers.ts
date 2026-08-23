import type { CountryState, GameState, Army } from '@conflict-game/shared-types';

/** Minimal country good enough for the pure tick functions. */
export function mkCountry(over: Partial<CountryState> = {}): CountryState {
  return {
    code: 'XX', name: 'Test', flag: '', region: '',
    economy: {
      gdp: 1000, gdpGrowth: 1, budget: 100, taxRate: 0.3, inflation: 2,
      tradeBalance: 0, debt: 10, sanctionResilience: 50, sanctionEvasion: 10,
    },
    military: {
      army: 100_000, navy: 30, airForce: 100, nuclearWeapons: 0,
      techLevel: 5, defenseBudget: 50,
    },
    stability: 60, approval: 60, diplomaticInfluence: 50, techLevel: 5,
    indexOfPower: 50, resources: {}, resourceState: {}, processingCapabilities: [],
    ...over,
  } as CountryState;
}

export function mkArmy(over: Partial<Army> = {}): Army {
  return {
    id: 'a1', ownerCountry: 'AA', sessionId: 's', name: 'Force',
    type: 'infantry', size: 20_000, morale: 80, experience: 10,
    latitude: 0, longitude: 0, targetLatitude: null, targetLongitude: null,
    status: 'idle', createdAtTick: 0,
    ...over,
  } as Army;
}

export function mkState(over: Partial<GameState> = {}): GameState {
  return {
    session: {
      id: 's', name: 'test', currentTick: 0, status: 'active',
      settings: {
        sessionDurationTicks: 9999,
        victoryConditions: ['domination', 'economic_hegemony', 'diplomatic', 'technological', 'survival'],
      },
      createdAt: '',
    },
    players: [], countries: {}, armies: [], relations: [], events: [],
    tensionIndex: 0,
    resourceMarket: { prices: {}, trends: {}, priceHistory: {} },
    processingChains: [],
    ...over,
  } as unknown as GameState;
}

/** Active war relation between two countries. */
export function war(a: string, b: string, tick = 0) {
  return {
    id: `w-${a}-${b}`, sessionId: 's', type: 'war', status: 'active',
    fromCountry: a, toCountry: b, createdAtTick: tick, expiresAtTick: null,
  } as GameState['relations'][number];
}
