import type { GameState, VictoryCondition } from '@conflict-game/shared-types';

export interface VictoryResult {
  achieved: boolean;
  winner: string | null;       // country code
  condition: VictoryCondition | null;
  scores: CountryScore[];
}

export interface CountryScore {
  code: string;
  indexOfPower: number;
  gdp: number;
  military: number;
  allies: number;
  techCount: number;
  rank: number;
}

/**
 * Check all victory conditions. Returns the first one met, or null.
 * Also computes leaderboard scores.
 */
export function checkVictoryConditions(state: GameState): VictoryResult {
  const scores = computeScores(state);
  const enabled = new Set(state.session.settings.victoryConditions);

  // Check each condition
  if (enabled.has('domination')) {
    const result = checkDomination(state, scores);
    if (result) return { achieved: true, winner: result, condition: 'domination', scores };
  }

  if (enabled.has('economic_hegemony')) {
    const result = checkEconomicHegemony(state, scores);
    if (result) return { achieved: true, winner: result, condition: 'economic_hegemony', scores };
  }

  if (enabled.has('diplomatic')) {
    const result = checkDiplomatic(state, scores);
    if (result) return { achieved: true, winner: result, condition: 'diplomatic', scores };
  }

  if (enabled.has('technological')) {
    const result = checkTechnological(state, scores);
    if (result) return { achieved: true, winner: result, condition: 'technological', scores };
  }

  // Survival: checked at session end (by tick limit)
  if (enabled.has('survival') && state.session.currentTick >= state.session.settings.sessionDurationTicks) {
    const winner = scores[0]?.code ?? null;
    return { achieved: true, winner, condition: 'survival', scores };
  }

  return { achieved: false, winner: null, condition: null, scores };
}

function computeScores(state: GameState): CountryScore[] {
  const allianceCounts: Record<string, number> = {};
  for (const rel of state.relations) {
    if (rel.type === 'alliance' && rel.status === 'active') {
      allianceCounts[rel.fromCountry] = (allianceCounts[rel.fromCountry] || 0) + 1;
      allianceCounts[rel.toCountry] = (allianceCounts[rel.toCountry] || 0) + 1;
    }
  }

  const scores: CountryScore[] = Object.entries(state.countries).map(([code, c]) => ({
    code,
    indexOfPower: c.indexOfPower,
    gdp: c.economy.gdp,
    military: c.military.army + c.military.navy * 2 + c.military.airForce * 3 + c.military.nuclearWeapons * 10000,
    allies: allianceCounts[code] || 0,
    techCount: c.tech?.researchedTechs.length ?? 0,
    rank: 0,
  }));

  scores.sort((a, b) => b.indexOfPower - a.indexOfPower);
  scores.forEach((s, i) => { s.rank = i + 1; });

  return scores;
}

/** Domination: highest power index > 80 */
function checkDomination(state: GameState, scores: CountryScore[]): string | null {
  const top = scores[0];
  if (!top) return null;
  if (top.indexOfPower >= 80 && scores.length > 1 && top.indexOfPower > scores[1].indexOfPower * 1.5) {
    return top.code;
  }
  return null;
}

/** Economic hegemony: GDP > 40% of world total */
function checkEconomicHegemony(state: GameState, scores: CountryScore[]): string | null {
  const totalGDP = scores.reduce((s, c) => s + c.gdp, 0);
  if (totalGDP <= 0) return null;
  for (const s of scores) {
    if (s.gdp / totalGDP > 0.4) return s.code;
  }
  return null;
}

/** Diplomatic: allied with 60%+ of countries */
function checkDiplomatic(state: GameState, scores: CountryScore[]): string | null {
  const totalCountries = scores.length;
  if (totalCountries <= 1) return null;
  for (const s of scores) {
    if (s.allies / (totalCountries - 1) >= 0.6) return s.code;
  }
  return null;
}

/** Technological: researched 30+ techs */
function checkTechnological(state: GameState, scores: CountryScore[]): string | null {
  for (const s of scores) {
    if (s.techCount >= 30) return s.code;
  }
  return null;
}
