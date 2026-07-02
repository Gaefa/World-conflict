import type { GameState, CountryData, CountryState } from '@conflict-game/shared-types';

/**
 * Pure per-render derivations for the main page: selected-country stats,
 * relation sets for globe coloring, leaderboard rows, etc. Extracted from
 * page.tsx so the page component stays layout-only.
 */

export interface SelectedCountryStats {
  name: string;
  code: string;
  gdp: number;
  population: number;
  militaryPower: number;
  stability: number;
  techLevel: number;
  powerIndex: number;
  isNonPlayable?: boolean;
}

export interface DerivedGameData {
  playerCountryCode: string | null;
  countryNames: Record<string, string>;
  selectedCountryStats: SelectedCountryStats | null;
  bottomTabsCountry: CountryState | null;
  events: { id: string; type: string; title: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; tick: number }[];
  playingCountries: string[];
  warCountries: Set<string>;
  allyCountries: Set<string>;
  sanctionedCountries: Set<string>;
  countryPoints: { lat: number; lng: number; code: string; name: string; flag: string; size: number; color: string }[];
  playerCount: number;
  victoryData: { winner?: string; condition?: string; scores?: { code: string; indexOfPower: number }[] } | undefined;
  leaderboardEntries: { code: string; name: string; flag: string; indexOfPower: number; gdp: number; military: number; isPlayer: boolean }[];
}

export function deriveGameData(
  gameState: GameState | null,
  playerId: string | null,
  seedCountries: CountryData[] | undefined,
  selectedCountryCode: string | null,
  clickedCountryName: string,
): DerivedGameData {
  const playerCountryCode = gameState?.players.find(p => p.id === playerId)?.countryCode ?? null;
  const countryNames = Object.fromEntries((seedCountries ?? []).map(c => [c.code, c.name]));

  const selectedCountryStats: SelectedCountryStats | null = (() => {
    if (!selectedCountryCode) return null;

    if (gameState?.countries[selectedCountryCode]) {
      const c = gameState.countries[selectedCountryCode];
      const seed = seedCountries?.find((s) => s.code === selectedCountryCode);
      return {
        name: seed?.name || selectedCountryCode,
        code: selectedCountryCode,
        gdp: c.economy.gdp * 1e9,
        population: seed?.population || 0,
        militaryPower: Math.min(100, c.military.army / 10000 + c.military.nuclearWeapons * 5),
        stability: c.stability,
        techLevel: c.techLevel,
        powerIndex: c.indexOfPower,
      };
    }

    const seed = seedCountries?.find((s) => s.code === selectedCountryCode);
    if (seed) {
      return {
        name: seed.name,
        code: seed.code,
        gdp: seed.startingState.economy.gdp * 1e9,
        population: seed.population,
        militaryPower: Math.min(
          100,
          seed.startingState.military.army / 10000 + seed.startingState.military.nuclearWeapons * 5,
        ),
        stability: seed.startingState.stability,
        techLevel: seed.startingState.techLevel,
        powerIndex: 0,
      };
    }

    return {
      name: clickedCountryName || selectedCountryCode,
      code: selectedCountryCode,
      gdp: 0,
      population: 0,
      militaryPower: 0,
      stability: 50,
      techLevel: 1,
      powerIndex: 0,
      isNonPlayable: true,
    };
  })();

  const bottomTabsCountry = (() => {
    if (gameState?.session.status === 'active' && playerCountryCode) {
      return gameState.countries[playerCountryCode] ?? null;
    }
    if (!selectedCountryCode) return null;
    const seed = seedCountries?.find((s) => s.code === selectedCountryCode);
    return seed ? seed.startingState : null;
  })();

  const events = (gameState?.events || []).slice(-30).reverse().map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    description: e.description,
    severity: e.severity as 'low' | 'medium' | 'high' | 'critical',
    tick: e.tick,
  }));

  const playingCountries = gameState ? Object.keys(gameState.countries) : [];

  // Relation sets for globe coloring
  const warCountries = new Set(
    (gameState?.relations ?? [])
      .filter(r => r.type === 'war' && r.status === 'active' &&
        (r.fromCountry === playerCountryCode || r.toCountry === playerCountryCode))
      .map(r => r.fromCountry === playerCountryCode ? r.toCountry : r.fromCountry),
  );
  const allyCountries = new Set(
    (gameState?.relations ?? [])
      .filter(r => r.type === 'alliance' && r.status === 'active' &&
        (r.fromCountry === playerCountryCode || r.toCountry === playerCountryCode))
      .map(r => r.fromCountry === playerCountryCode ? r.toCountry : r.fromCountry),
  );
  const sanctionedCountries = new Set(
    (gameState?.relations ?? [])
      .filter(r => r.type === 'sanction' && r.status === 'active' &&
        r.fromCountry === playerCountryCode)
      .map(r => r.toCountry),
  );

  const countryPoints = seedCountries?.map((c) => {
    const isPlaying = !!gameState?.countries[c.code];
    const isSelected = selectedCountryCode === c.code;
    return {
      lat: c.latitude,
      lng: c.longitude,
      code: c.code,
      name: c.name,
      flag: c.flag,
      size: isSelected ? 1.0 : isPlaying ? 0.8 : 0.5,
      color: isSelected ? '#ff0000' : isPlaying ? '#f59e0b' : '#8b95a5',
    };
  }) || [];

  const playerCount = gameState?.players.filter((p) => p.isOnline).length || 0;

  // Victory detection
  const victoryEvent = gameState?.events.find(e => e.type === 'victory');
  const victoryData = victoryEvent?.data as DerivedGameData['victoryData'];

  // Leaderboard data
  const leaderboardEntries = seedCountries && gameState ? seedCountries
    .filter(sc => gameState.countries[sc.code])
    .map(sc => {
      const c = gameState.countries[sc.code];
      return {
        code: sc.code,
        name: sc.name,
        flag: sc.flag,
        indexOfPower: c.indexOfPower,
        gdp: c.economy.gdp,
        military: c.military.army + c.military.navy * 2 + c.military.airForce * 3,
        isPlayer: sc.code === playerCountryCode,
      };
    }) : [];

  return {
    playerCountryCode,
    countryNames,
    selectedCountryStats,
    bottomTabsCountry,
    events,
    playingCountries,
    warCountries,
    allyCountries,
    sanctionedCountries,
    countryPoints,
    playerCount,
    victoryData,
    leaderboardEntries,
  };
}
