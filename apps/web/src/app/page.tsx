'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { GlobeWrapper } from '@/components/globe/GlobeWrapper';
import { EventsFeed } from '@/components/panels/EventsFeed';
import { CountryPanel } from '@/components/panels/CountryPanel';
import { BottomTabs } from '@/components/panels/BottomTabs';
import { CreateSessionModal } from '@/components/ui/CreateSessionModal';
import { ActionToast } from '@/components/ui/ActionToast';
import { LocalePicker } from '@/components/ui/LocalePicker';
import { OnboardingTutorial } from '@/components/ui/OnboardingTutorial';
import { VictoryOverlay } from '@/components/ui/VictoryOverlay';
import { Leaderboard } from '@/components/panels/Leaderboard';
import { useGameStore } from '@/stores/gameStore';
import { useLocaleStore } from '@/stores/localeStore';
import { useCountries } from '@/hooks/useCountries';

export default function Home() {
  const [modalMode, setModalMode] = useState<null | 'singleplayer' | 'multiplayer'>(null);
  const [clickedCountryName, setClickedCountryName] = useState<string>('');
  const [showVictory, setShowVictory] = useState(true);

  const { t, isFirstLaunch, showTutorial, markTutorialDone } = useLocaleStore();

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

  const playerCountryCode = gameState?.players.find(p => p.id === playerId)?.countryCode ?? null;

  const handleCountryClick = useCallback(
    (code: string, name: string) => {
      setSelectedCountry(code);
      setClickedCountryName(name);
    },
    [setSelectedCountry],
  );

  const selectedCountryStats = (() => {
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
  const victoryData = victoryEvent?.data as { winner?: string; condition?: string; scores?: { code: string; indexOfPower: number }[] } | undefined;

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

  return (
    <div className="h-screen flex flex-col">
      {/* Locale picker on first launch */}
      {isFirstLaunch && <LocalePicker />}

      {/* Onboarding tutorial (shown after locale pick on first launch, or via help button) */}
      {!isFirstLaunch && showTutorial && (
        <OnboardingTutorial onClose={markTutorialDone} />
      )}

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

          {sessionId && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-bg-card border border-border-default rounded px-4 py-2 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-green' : 'bg-accent-red'}`} />
                <span className="text-text-secondary text-xs">
                  {connected ? t.connected : t.disconnected}
                </span>
                <span className="text-text-muted text-xs font-mono">
                  {t.header_tension_short}: {tensionIndex.toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {!sessionId && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex gap-3">
              <button
                onClick={() => setModalMode('singleplayer')}
                className="pointer-events-auto bg-accent-green hover:bg-green-600 text-white px-6 py-3 rounded font-bold uppercase tracking-wider transition-colors shadow-lg shadow-green-900/30 cursor-pointer"
              >
                {t.mode_singleplayer}
              </button>
              <button
                onClick={() => setModalMode('multiplayer')}
                className="pointer-events-auto bg-accent-red hover:bg-red-600 text-white px-6 py-3 rounded font-bold uppercase tracking-wider transition-colors shadow-lg shadow-red-900/30 cursor-pointer"
              >
                {t.mode_multiplayer}
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

      {/* Leaderboard (top-right corner during active game) */}
      {gameState?.session.status === 'active' && leaderboardEntries.length > 0 && (
        <div className="fixed top-14 right-2 z-30 w-72">
          <Leaderboard entries={leaderboardEntries} />
        </div>
      )}

      <ActionToast />

      {modalMode && (
        <CreateSessionModal mode={modalMode} onClose={() => setModalMode(null)} />
      )}

      {/* Victory overlay */}
      {victoryData?.winner && showVictory && (
        <VictoryOverlay
          winner={victoryData.winner}
          winnerName={seedCountries?.find(s => s.code === victoryData.winner)?.name || victoryData.winner}
          winnerFlag={seedCountries?.find(s => s.code === victoryData.winner)?.flag || ''}
          condition={victoryData.condition || 'survival'}
          scores={(victoryData.scores || []).map(s => ({
            ...s,
            name: seedCountries?.find(sc => sc.code === s.code)?.name || s.code,
            flag: seedCountries?.find(sc => sc.code === s.code)?.flag || '',
          }))}
          onClose={() => setShowVictory(false)}
        />
      )}
    </div>
  );
}
