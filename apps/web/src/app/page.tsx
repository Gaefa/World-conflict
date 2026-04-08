'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { GlobeWrapper } from '@/components/globe/GlobeWrapper';
import { EventsFeed } from '@/components/panels/EventsFeed';
import { CountryPanel } from '@/components/panels/CountryPanel';
import { BottomTabs } from '@/components/panels/BottomTabs';
import { CreateSessionModal } from '@/components/ui/CreateSessionModal';
import { ActionToast } from '@/components/ui/ActionToast';
import { useGameStore } from '@/stores/gameStore';
import { useCountries } from '@/hooks/useCountries';

export default function Home() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clickedCountryName, setClickedCountryName] = useState<string>('');

  const {
    gameState,
    currentTick,
    tensionIndex,
    selectedCountryCode,
    isPaused,
    sessionId,
    connected,
    setSelectedCountry,
    sendAction,
    togglePause,
    playerId,
  } = useGameStore();

  const { data: seedCountries } = useCountries();

  // Find the player's own country code
  const playerCountryCode = gameState?.players.find(p => p.id === playerId)?.countryCode ?? null;

  const handleCountryClick = useCallback(
    (code: string, name: string) => {
      setSelectedCountry(code);
      setClickedCountryName(name);
    },
    [setSelectedCountry],
  );

  // Get country stats for selected country
  const selectedCountryStats = (() => {
    if (!selectedCountryCode) return null;

    // If game is active, use live state
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

    // Use seed data if available
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

    // Non-game country — show basic info from polygon click
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

  // Get full CountryState for BottomTabs
  // During active game: always show player's own country (actions available)
  // Before game: show selected country from globe
  const bottomTabsCountry = (() => {
    if (gameState?.session.status === 'active' && playerCountryCode) {
      return gameState.countries[playerCountryCode] ?? null;
    }

    if (!selectedCountryCode) return null;

    // Seed data — construct CountryState from startingState
    const seed = seedCountries?.find((s) => s.code === selectedCountryCode);
    if (seed) {
      return seed.startingState;
    }

    return null;
  })();

  // Events for feed
  const events = (gameState?.events || []).slice(-30).reverse().map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    description: e.description,
    severity: e.severity as 'low' | 'medium' | 'high' | 'critical',
    tick: e.tick,
  }));

  // Countries playing in session (for globe highlighting)
  const playingCountries = gameState ? Object.keys(gameState.countries) : [];

  // Country points for the globe (from seed data)
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

  return (
    <div className="h-screen flex flex-col">
      <Header
        activeSessions={sessionId ? 1 : 0}
        onlinePlayers={playerCount}
        currentTick={currentTick}
        isPaused={isPaused}
        tensionIndex={tensionIndex}
        onTogglePause={togglePause}
      />

      <main className="flex-1 flex overflow-hidden">
        <EventsFeed events={events} />

        <div className="flex-1 relative bg-bg-primary">
          <GlobeWrapper
            onCountryClick={handleCountryClick}
            selectedCountry={selectedCountryCode}
            highlightedCountries={playingCountries}
            countryPoints={countryPoints}
            gameCountryCodes={seedCountries?.map((c) => c.code) || []}
          />

          {/* Status indicator */}
          {sessionId && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-bg-card border border-border-default rounded px-4 py-2 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-green' : 'bg-accent-red'}`} />
                <span className="text-text-secondary text-xs">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
                <span className="text-text-muted text-xs font-mono">
                  Tension: {tensionIndex.toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* Create Session button (when no game active) */}
          {!sessionId && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <button
                onClick={() => setShowCreateModal(true)}
                className="pointer-events-auto bg-accent-red hover:bg-red-600 text-white px-6 py-3 rounded font-bold uppercase tracking-wider transition-colors shadow-lg shadow-red-900/30 cursor-pointer"
              >
                Create Game Session
              </button>
            </div>
          )}
        </div>

        <CountryPanel country={selectedCountryStats} />
      </main>

      <BottomTabs
        country={bottomTabsCountry}
        isNonPlayable={!gameState && selectedCountryStats?.isNonPlayable}
        countryName={
          gameState?.session.status === 'active'
            ? seedCountries?.find(s => s.code === playerCountryCode)?.name || playerCountryCode || undefined
            : selectedCountryStats?.name
        }
        onAction={sendAction}
        targetCountryCode={selectedCountryCode}
        playerCountryCode={playerCountryCode}
        isGameActive={gameState?.session.status === 'active'}
        hasSanctions={!!playerCountryCode && !!gameState?.relations.some(
          r => r.toCountry === playerCountryCode && r.type === 'sanction' && r.status === 'active'
        )}
        relations={gameState?.relations}
        currentTick={currentTick}
      />

      <ActionToast />

      {showCreateModal && (
        <CreateSessionModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
