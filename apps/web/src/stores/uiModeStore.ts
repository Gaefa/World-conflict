'use client';

import { create } from 'zustand';

export type UiMode = 'cards' | 'console';

const STORAGE_KEY = 'conflict-game-ui-mode';

function getStoredMode(): UiMode {
  if (typeof window === 'undefined') return 'cards';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'console' ? 'console' : 'cards';
}

interface UiModeStore {
  /** 'cards' — simplified card hand (default); 'console' — full tabs (hardcore). */
  mode: UiMode;
  setMode: (mode: UiMode) => void;
}

export const useUiModeStore = create<UiModeStore>((set) => ({
  mode: getStoredMode(),
  setMode: (mode) => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, mode);
    set({ mode });
  },
}));
