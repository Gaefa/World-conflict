'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { listGames, deleteGame, type SaveSnapshot } from '@/lib/save-store';

interface SaveLoadModalProps {
  /** 'save' = save current game, 'load' = browse and restore. */
  mode: 'save' | 'load';
  onClose: () => void;
}

export function SaveLoadModal({ mode, onClose }: SaveLoadModalProps) {
  const { saveGame, loadGame } = useGameStore();
  const [slots, setSlots] = useState<Omit<SaveSnapshot, 'gameState' | 'aiStates'>[]>([]);
  const [slotName, setSlotName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Refresh slot list whenever the modal opens.
  useEffect(() => {
    listGames().then(setSlots).catch(() => setSlots([]));
  }, []);

  const handleSave = async () => {
    const name = slotName.trim() || defaultSlotName();
    setLoading(true);
    setError('');
    try {
      await saveGame(name);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (snap: Omit<SaveSnapshot, 'gameState' | 'aiStates'>) => {
    setLoading(true);
    setError('');
    try {
      const { loadGame: idbLoad } = await import('@/lib/save-store');
      const full = await idbLoad(snap.name);
      if (!full) { setError('Save slot not found'); return; }
      await loadGame(full);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteGame(name);
    setSlots(prev => prev.filter(s => s.name !== name));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-secondary border border-border-default rounded-lg w-full max-w-md max-h-[70vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h2 className="text-lg font-bold uppercase tracking-wider">
            {mode === 'save' ? '💾 Save Game' : '📂 Load Game'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="bg-severity-high/20 border border-severity-high/30 rounded p-2 text-sm text-severity-high">
              {error}
            </div>
          )}

          {mode === 'save' && (
            <div>
              <label className="text-text-secondary text-sm block mb-1">Slot name</label>
              <input
                type="text"
                value={slotName}
                onChange={e => setSlotName(e.target.value)}
                placeholder={defaultSlotName()}
                className="w-full bg-bg-card border border-border-default rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent-green focus:outline-none text-sm"
              />
            </div>
          )}

          {slots.length === 0 && mode === 'load' && (
            <p className="text-text-muted text-sm text-center py-6">No saved games yet.</p>
          )}

          {slots.map(slot => (
            <button
              key={slot.name}
              disabled={loading}
              onClick={() => mode === 'load' ? handleLoad(slot) : null}
              className={`w-full flex items-center justify-between bg-bg-card border border-border-default rounded p-3 text-left transition-colors disabled:opacity-50 ${mode === 'load' ? 'hover:border-accent-green cursor-pointer' : 'cursor-default'}`}
            >
              <div>
                <div className="text-text-primary text-sm font-medium">{slot.name}</div>
                <div className="text-text-muted text-xs mt-0.5">
                  {slot.sessionName} · Tick {slot.tick} · {formatDate(slot.timestamp)}
                </div>
              </div>
              <button
                onClick={e => handleDelete(slot.name, e)}
                className="text-text-muted hover:text-severity-high transition-colors text-xs px-2 py-1 rounded hover:bg-severity-high/10 shrink-0 ml-2"
                title="Delete"
              >
                🗑
              </button>
            </button>
          ))}
        </div>

        {mode === 'save' && (
          <div className="p-4 border-t border-border-default">
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-accent-green hover:bg-green-600 text-white py-2 rounded font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function defaultSlotName(): string {
  const now = new Date();
  return `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}
