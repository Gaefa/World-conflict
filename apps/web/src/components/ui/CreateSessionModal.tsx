'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useCountries } from '@/hooks/useCountries';

interface CreateSessionModalProps {
  onClose: () => void;
}

export function CreateSessionModal({ onClose }: CreateSessionModalProps) {
  const [step, setStep] = useState<'create' | 'country' | 'ready'>('create');
  const [sessionName, setSessionName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { createSession, selectCountry, startGame, selectedCountryCode } = useGameStore();
  const { data: countries } = useCountries();

  const handleCreate = async () => {
    if (!sessionName.trim() || !playerName.trim()) {
      setError('Fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createSession(sessionName.trim(), playerName.trim());
      setStep('country');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create session');
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
      setError(e instanceof Error ? e.message : 'Failed to select country');
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
      setError(e instanceof Error ? e.message : 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-secondary border border-border-default rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h2 className="text-lg font-bold uppercase tracking-wider">
            {step === 'create' && 'New Session'}
            {step === 'country' && 'Select Country'}
            {step === 'ready' && 'Ready to Start'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="bg-severity-high/20 border border-severity-high/30 rounded p-2 mb-4 text-sm text-severity-high">
              {error}
            </div>
          )}

          {step === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="text-text-secondary text-sm block mb-1">Session Name</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="World War III"
                  className="w-full bg-bg-card border border-border-default rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent-red focus:outline-none"
                />
              </div>
              <div>
                <label className="text-text-secondary text-sm block mb-1">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Commander"
                  className="w-full bg-bg-card border border-border-default rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent-red focus:outline-none"
                />
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
                      GDP: ${(c.startingState.economy.gdp / 1000).toFixed(1)}T | Power: {Math.round(c.startingState.military.army / 10000)}
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
              <p className="text-text-secondary mb-6">
                Ready to lead your nation. Press start to begin the game.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-default">
          {step === 'create' && (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-accent-red hover:bg-red-600 text-white py-2 rounded font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Session'}
            </button>
          )}
          {step === 'ready' && (
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full bg-accent-green hover:bg-green-600 text-white py-2 rounded font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Game'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
