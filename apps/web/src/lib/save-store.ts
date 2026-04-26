/**
 * IndexedDB-backed save-game store for singleplayer sessions.
 *
 * Each save slot is a JSON blob containing the full GameState and the AI
 * states for every country. Loading a slot fully restores the engine to
 * the exact moment of the save (determinism from the RNG is NOT guaranteed
 * across saves — RNG state is discarded — but game numbers are correct).
 *
 * Schema:  DB "conflict-saves"  /  object-store "slots"  /  keyPath "name"
 */

import type { GameState } from '@conflict-game/shared-types';
import type { AIState } from '@conflict-game/game-engine';

export interface SaveSnapshot {
  /** User-visible name of the slot (also the IDB key). */
  name: string;
  /** Unix ms timestamp of the save. */
  timestamp: number;
  /** In-game tick at the moment of the save. */
  tick: number;
  /** Human-readable session name stored in GameState. */
  sessionName: string;
  /** Full game state as of save time. */
  gameState: GameState;
  /**
   * AI states keyed by country code. Map is serialised as a plain object
   * (JSON-safe) because IDB cannot store Map directly.
   */
  aiStates: Record<string, AIState>;
  /** Which country the human player was controlling. */
  playerCountryCode: string;
  /** The player's ID (UUID) so we can reconnect after reload. */
  playerId: string;
}

// ─── DB lifecycle ─────────────────────────────────────────────────────────────

const DB_NAME = 'conflict-saves';
const DB_VERSION = 1;
const STORE = 'slots';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Persist a snapshot. Overwrites any existing slot with the same name. */
export async function saveGame(snapshot: SaveSnapshot): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  await idbRequest(tx.objectStore(STORE).put(snapshot));
  db.close();
}

/** Load a saved snapshot by name. Returns null if the slot does not exist. */
export async function loadGame(name: string): Promise<SaveSnapshot | null> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const result = await idbRequest<SaveSnapshot | undefined>(tx.objectStore(STORE).get(name));
  db.close();
  return result ?? null;
}

/** List all save slots, newest first. */
export async function listGames(): Promise<Omit<SaveSnapshot, 'gameState' | 'aiStates'>[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const all = await idbRequest<SaveSnapshot[]>(tx.objectStore(STORE).getAll());
  db.close();
  return all
    .map(({ name, timestamp, tick, sessionName, playerCountryCode, playerId }) => ({
      name, timestamp, tick, sessionName, playerCountryCode, playerId,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** Delete a save slot. No-op if the slot does not exist. */
export async function deleteGame(name: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  await idbRequest(tx.objectStore(STORE).delete(name));
  db.close();
}
