import type { CountryState, DiplomaticRelation } from '@conflict-game/shared-types';

/** Check if two countries are at war */
export function areAtWar(relations: DiplomaticRelation[], country1: string, country2: string): boolean {
  return relations.some(
    r => r.type === 'war' && r.status === 'active' &&
    ((r.fromCountry === country1 && r.toCountry === country2) ||
     (r.fromCountry === country2 && r.toCountry === country1))
  );
}

/** Check if two countries are allies */
export function areAllies(relations: DiplomaticRelation[], country1: string, country2: string): boolean {
  return relations.some(
    r => r.type === 'alliance' && r.status === 'active' &&
    ((r.fromCountry === country1 && r.toCountry === country2) ||
     (r.fromCountry === country2 && r.toCountry === country1))
  );
}

/** Get all allies of a country */
export function getAllies(relations: DiplomaticRelation[], countryCode: string): string[] {
  return relations
    .filter(r => r.type === 'alliance' && r.status === 'active' &&
      (r.fromCountry === countryCode || r.toCountry === countryCode))
    .map(r => r.fromCountry === countryCode ? r.toCountry : r.fromCountry);
}

/** Get all countries at war with this country */
export function getEnemies(relations: DiplomaticRelation[], countryCode: string): string[] {
  return relations
    .filter(r => r.type === 'war' && r.status === 'active' &&
      (r.fromCountry === countryCode || r.toCountry === countryCode))
    .map(r => r.fromCountry === countryCode ? r.toCountry : r.fromCountry);
}

/** Calculate diplomatic influence change from alliances */
export function allianceInfluenceBonus(allyCount: number): number {
  // Diminishing returns: first allies give more
  return Math.min(30, allyCount * 5);
}

/** Calculate sanction effect on target country's GDP */
export function sanctionEffect(
  sanctioningCountries: CountryState[],
  target: CountryState
): number {
  // Total economic pressure as % of target GDP
  const totalSanctionGdp = sanctioningCountries.reduce((sum, c) => sum + c.economy.gdp, 0);
  const pressure = totalSanctionGdp / (target.economy.gdp * 10);
  return -Math.min(0.05, pressure); // Max 5% GDP reduction per tick cycle
}
