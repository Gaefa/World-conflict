'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useLocaleStore } from '@/stores/localeStore';
import { useCountries } from '@/hooks/useCountries';
import { InMemoryTransport, WebSocketTransport } from '@/lib/transport';
import { getLanInfo, isDesktopHost, type LanInfo } from '@/lib/electron-bridge';

interface CreateSessionModalProps {
  onClose: () => void;
  mode?: 'singleplayer' | 'multiplayer';
}

/** Multiplayer sub-mode: am I running the server, or connecting to someone else's? */
type MultiplayerRole = 'host' | 'join';

export function CreateSessionModal({ onClose, mode = 'multiplayer' }: CreateSessionModalProps) {
  const [step, setStep] = useState<'create' | 'country' | 'ready'>('create');
  const [sessionName, setSessionName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');

  // Multiplayer-only: host LAN vs. join a friend's LAN/remote server.
  // Desktop users default to 'host' because they have the embedded server;
  // pure-browser users default to 'join' because they have nothing to host.
  const [mpRole, setMpRole] = useState<MultiplayerRole>(() => (isDesktopHost() ? 'host' : 'join'));
  const [joinUrl, setJoinUrl] = useState('');
  const [lanInfo, setLanInfo] = useState<LanInfo | null>(null);

  const { t } = useLocaleStore();
  const { createSession, selectCountry, startGame, selectedCountryCode, setTransport } = useGameStore();
  const { data: countries } = useCountries();

  // Pull LAN URLs once when the modal opens inside Electron so the host can
  // copy them out and share with friends.
  useEffect(() => {
    if (mode !== 'multiplayer') return;
    if (!isDesktopHost()) return;
    getLanInfo().then(setLanInfo).catch(() => setLanInfo(null));
  }, [mode]);

  const handleCreate = async () => {
    if (!sessionName.trim() || !playerName.trim()) {
      setError(t.session_fill_fields);
      return;
    }
    if (mode === 'multiplayer' && mpRole === 'join' && !joinUrl.trim()) {
      setError(t.session_fill_fields);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Fresh transport each time — ensures the previous session is cleaned up
      // and switches modes cleanly if the user reopens with a different choice.
      // - Singleplayer: in-browser engine (InMemoryTransport).
      // - Host LAN: WS transport to our own embedded server (default URL
      //   = http://localhost:3002 in Electron).
      // - Join LAN / remote: WS transport to whatever URL the user pasted.
      let transport;
      if (mode === 'singleplayer') {
        transport = new InMemoryTransport();
      } else if (mpRole === 'host') {
        transport = new WebSocketTransport();
      } else {
        transport = new WebSocketTransport({ apiUrl: joinUrl.trim() });
      }
      setTransport(transport);
      await createSession(sessionName.trim(), playerName.trim(), { allowAI: aiEnabled, aiDifficulty });
      setStep('country');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCountry = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      await selectCountry(code);
      setStep('ready');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      await startGame();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const AI_LABELS = {
    easy: t.ai_easy,
    normal: t.ai_normal,
    hard: t.ai_hard,
  };
  const AI_DESCS = {
    easy: t.ai_easy_desc,
    normal: t.ai_normal_desc,
    hard: t.ai_hard_desc,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-secondary border border-border-default rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h2 className="text-lg font-bold uppercase tracking-wider">
            {step === 'create' && `${t.session_new} — ${mode === 'singleplayer' ? t.mode_singleplayer : t.mode_multiplayer}`}
            {step === 'country' && t.session_select_country}
            {step === 'ready' && t.session_ready}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            {'\u2715'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="bg-severity-high/20 border border-severity-high/30 rounded p-2 mb-4 text-sm text-severity-high">
              {error}
            </div>
          )}

          {step === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="text-text-secondary text-sm block mb-1">{t.session_name}</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder={t.session_name_placeholder}
                  className="w-full bg-bg-card border border-border-default rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent-red focus:outline-none"
                />
              </div>
              <div>
                <label className="text-text-secondary text-sm block mb-1">{t.session_your_name}</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={t.session_your_name_placeholder}
                  className="w-full bg-bg-card border border-border-default rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent-red focus:outline-none"
                />
              </div>

              {mode === 'multiplayer' && (
                <div className="border border-border-default rounded p-3 space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMpRole('host')}
                      disabled={!isDesktopHost()}
                      className={`flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                        mpRole === 'host'
                          ? 'bg-accent-red/20 text-accent-red border border-accent-red/40'
                          : 'bg-bg-card border border-border-default text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {'Host LAN'}
                    </button>
                    <button
                      onClick={() => setMpRole('join')}
                      className={`flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                        mpRole === 'join'
                          ? 'bg-accent-red/20 text-accent-red border border-accent-red/40'
                          : 'bg-bg-card border border-border-default text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {'Join'}
                    </button>
                  </div>

                  {mpRole === 'host' && isDesktopHost() && (
                    <div className="bg-bg-card border border-border-default rounded p-2 text-xs space-y-1">
                      <div className="text-text-muted">
                        {'Share these URLs with players on your LAN:'}
                      </div>
                      {lanInfo && lanInfo.ipv4.length > 0 ? (
                        lanInfo.ipv4.map((ip) => (
                          <code
                            key={ip}
                            className="block text-accent-green font-mono select-all"
                          >
                            {`http://${ip}:${lanInfo.port}`}
                          </code>
                        ))
                      ) : (
                        <div className="text-text-muted italic">
                          {'No LAN interfaces detected'}
                        </div>
                      )}
                    </div>
                  )}

                  {mpRole === 'host' && !isDesktopHost() && (
                    <div className="text-text-muted text-xs">
                      {'Hosting requires the desktop app. In a browser, choose Join.'}
                    </div>
                  )}

                  {mpRole === 'join' && (
                    <div>
                      <label className="text-text-muted text-xs block mb-1">
                        {'Server URL'}
                      </label>
                      <input
                        type="text"
                        value={joinUrl}
                        onChange={(e) => setJoinUrl(e.target.value)}
                        placeholder="http://192.168.1.42:3002"
                        className="w-full bg-bg-card border border-border-default rounded px-3 py-1.5 text-text-primary placeholder:text-text-muted focus:border-accent-red focus:outline-none text-sm font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="border border-border-default rounded p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-text-secondary text-sm">{t.ai_opponents}</label>
                  <button
                    onClick={() => setAiEnabled(!aiEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${aiEnabled ? 'bg-accent-green' : 'bg-bg-card border border-border-default'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${aiEnabled ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                {aiEnabled && (
                  <div>
                    <label className="text-text-muted text-xs block mb-1">{t.ai_difficulty}</label>
                    <div className="flex gap-2">
                      {(['easy', 'normal', 'hard'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setAiDifficulty(d)}
                          className={`flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                            aiDifficulty === d
                              ? d === 'easy' ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                              : d === 'normal' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-severity-high/20 text-severity-high border border-severity-high/40'
                              : 'bg-bg-card border border-border-default text-text-muted hover:text-text-primary'
                          }`}
                        >
                          {AI_LABELS[d]}
                        </button>
                      ))}
                    </div>
                    <p className="text-text-muted text-xs mt-1">{AI_DESCS[aiDifficulty]}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'country' && (
            <div className="grid grid-cols-2 gap-2">
              {countries?.map((c) => (
                <button
                  key={c.code}
                  onClick={() => handleSelectCountry(c.code)}
                  disabled={loading}
                  className="flex items-center gap-2 bg-bg-card border border-border-default rounded p-3 hover:border-accent-red hover:bg-bg-hover transition-colors text-left disabled:opacity-50"
                >
                  <span className="text-xl">{c.flag}</span>
                  <div>
                    <div className="text-text-primary text-sm font-medium">{c.name}</div>
                    <div className="text-text-muted text-xs">
                      {t.cp_gdp}: ${(c.startingState.economy.gdp / 1000).toFixed(1)}T
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 'ready' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">
                {countries?.find((c) => c.code === selectedCountryCode)?.flag}
              </div>
              <h3 className="text-xl font-bold mb-2">
                {countries?.find((c) => c.code === selectedCountryCode)?.name}
              </h3>
              <p className="text-text-secondary mb-6">{t.session_ready_desc}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-default">
          {step === 'create' && (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-accent-red hover:bg-red-600 text-white py-2 rounded font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {loading ? t.session_creating : t.session_create}
            </button>
          )}
          {step === 'ready' && (
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full bg-accent-green hover:bg-green-600 text-white py-2 rounded font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {loading ? t.session_starting : t.session_start}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
