'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { GlobeWrapper } from '@/components/globe/GlobeWrapper';
import { EventsFeed } from '@/components/panels/EventsFeed';
import { CountryPanel } from '@/components/panels/CountryPanel';
import { BottomTabs } from '@/components/panels/BottomTabs';
import { CreateSessionModal } from '@/components/ui/CreateSessionModal';
import { SaveLoadModal } from '@/components/ui/SaveLoadModal';
import { PriceTicker } from '@/components/ui/PriceTicker';
import { ActionToast } from '@/components/ui/ActionToast';
import { ProposalInbox } from '@/components/ui/ProposalInbox';
import { ProposalOutcomeToast } from '@/components/ui/ProposalOutcomeToast';
import { LocalePicker } from '@/components/ui/LocalePicker';
import { OnboardingTutorial } from '@/components/ui/OnboardingTutorial';
import { GoalsPanel } from '@/components/ui/GoalsPanel';
import { VictoryOverlay } from '@/components/ui/VictoryOverlay';
import { Leaderboard } from '@/components/panels/Leaderboard';
import { CardHand } from '@/components/cards/CardHand';
import { useGameStore } from '@/stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useLocaleStore } from '@/stores/localeStore';
import { useUiModeStore } from '@/stores/uiModeStore';
import { useCountries } from '@/hooks/useCountries';
import { deriveGameData } from '@/lib/deriveGameData';

export default function Home() {
  const [modalMode, setModalMode] = useState<null | 'singleplayer' | 'multiplayer'>(null);
  const [saveLoadMode, setSaveLoadMode] = useState<null | 'save' | 'load'>(null);
  const [clickedCountryName, setClickedCountryName] = useState<string>('');
  const [showVictory, setShowVictory] = useState(true);

  const { t, isFirstLaunch, showTutorial, markTutorialDone } = useLocaleStore();

  const {
    gameState,
    currentTick,
    tensionIndex,
    tickDurationMs,
    lastTickAt,
    selectedCountryCode,
    isPaused,
    sessionId,
    connected,
    setSelectedCountry,
    sendAction,
    togglePause,
    playerId,
    canSave,
  } = useGameStore(useShallow(s => ({
    gameState: s.gameState,
    currentTick: s.currentTick,
    tensionIndex: s.tensionIndex,
    tickDurationMs: s.tickDurationMs,
    lastTickAt: s.lastTickAt,
    selectedCountryCode: s.selectedCountryCode,
    isPaused: s.isPaused,
    sessionId: s.sessionId,
    connected: s.connected,
    setSelectedCountry: s.setSelectedCountry,
    sendAction: s.sendAction,
    togglePause: s.togglePause,
    playerId: s.playerId,
    canSave: s.canSave,
  })));

  const { data: seedCountries } = useCountries();
  const { mode: uiMode, setMode: setUiMode } = useUiModeStore();

  const handleCountryClick = useCallback(
    (code: string, name: string) => {
      setSelectedCountry(code);
      setClickedCountryName(name);
    },
    [setSelectedCountry],
  );

  // All pure per-render derivations live in deriveGameData
  const {
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
  } = deriveGameData(gameState, playerId, seedCountries, selectedCountryCode, clickedCountryName);

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
        tickDurationMs={tickDurationMs}
        lastTickAt={lastTickAt}
        onTogglePause={togglePause}
        canSave={canSave && gameState?.session.status === 'active'}
        onSave={() => setSaveLoadMode('save')}
      />

      <main className="flex-1 flex overflow-hidden">
        <EventsFeed
          events={events}
          countryNames={Object.fromEntries((seedCountries ?? []).map(c => [c.code, c.name]))}
        />

        <div className="flex-1 relative bg-bg-primary">
          <GlobeWrapper
            onCountryClick={handleCountryClick}
            selectedCountry={selectedCountryCode}
            highlightedCountries={playingCountries}
            countryPoints={countryPoints}
            gameCountryCodes={seedCountries?.map((c) => c.code) || []}
            isGameActive={gameState?.session.status === 'active'}
            warCountries={warCountries}
            allyCountries={allyCountries}
            sanctionedCountries={sanctionedCountries}
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

          {/* Goals panel — visible once player has a country */}
          {gameState?.session.status === 'active' && playerCountryCode && seedCountries && (
            <div className="absolute bottom-4 left-4 z-20">
              <GoalsPanel
                gameState={gameState}
                playerCountryCode={playerCountryCode}
                currentTick={currentTick}
                seedCountries={seedCountries}
              />
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
                onClick={() => setSaveLoadMode('load')}
                className="pointer-events-auto bg-bg-secondary hover:bg-bg-card text-text-secondary hover:text-text-primary px-6 py-3 rounded font-bold uppercase tracking-wider transition-colors shadow-lg border border-border-default cursor-pointer"
              >
                📂 Load
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

      {gameState?.resourceMarket && Object.keys(gameState.resourceMarket.prices).length > 0 && (
        <PriceTicker market={gameState.resourceMarket} />
      )}

      {/* Cards mode (default): hand of action cards. Console mode (hardcore): full tabs. */}
      {uiMode === 'cards' && gameState?.session.status === 'active' && playerCountryCode && gameState.countries[playerCountryCode] ? (
        <CardHand
          country={gameState.countries[playerCountryCode]}
          selectedCountryCode={selectedCountryCode}
          playerCountryCode={playerCountryCode}
          home={(() => {
            const seed = seedCountries?.find(s => s.code === playerCountryCode);
            return seed ? { lat: seed.latitude, lng: seed.longitude } : null;
          })()}
          warEnemies={[...warCountries]}
          onAction={sendAction}
          countryNames={countryNames}
        />
      ) : (
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
          armies={gameState?.armies}
          allCountries={gameState?.countries}
          warCountries={warCountries}
        />
      )}

      {/* UI mode toggle — only during an active game */}
      {gameState?.session.status === 'active' && playerCountryCode && (
        <button
          onClick={() => setUiMode(uiMode === 'cards' ? 'console' : 'cards')}
          className="fixed bottom-3 right-3 z-40 bg-bg-secondary border border-border-default hover:border-accent-amber/60 text-text-secondary hover:text-text-primary text-xs px-3 py-1.5 rounded transition-colors cursor-pointer"
        >
          {uiMode === 'cards' ? t.ui_mode_console : t.ui_mode_cards}
        </button>
      )}

      {/* Leaderboard (top-right corner during active game) */}
      {gameState?.session.status === 'active' && leaderboardEntries.length > 0 && (
        <div className="fixed top-14 right-2 z-30 w-72">
          <Leaderboard entries={leaderboardEntries} />
        </div>
      )}

      <ActionToast />

      {/* Floating proposal inbox — shows incoming AI proposals without opening Diplomacy tab */}
      {gameState?.session.status === 'active' && playerCountryCode && gameState.relations && (
        <>
          <ProposalInbox
            playerCountryCode={playerCountryCode}
            relations={gameState.relations}
            countryNames={countryNames}
            onAction={sendAction}
          />
          <ProposalOutcomeToast countryNames={countryNames} />
        </>
      )}

      {modalMode && (
        <CreateSessionModal mode={modalMode} onClose={() => setModalMode(null)} />
      )}

      {saveLoadMode && (
        <SaveLoadModal mode={saveLoadMode} onClose={() => setSaveLoadMode(null)} />
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
