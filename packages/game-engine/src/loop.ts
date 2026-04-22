/**
 * GameLoop — thin transport wrapper around `runTick`.
 *
 * Responsibilities left here:
 *   - owning the setInterval per session
 *   - per-session RNG lifecycle
 *   - persisting state via the injected GameStateStore
 *   - routing action_result and state_delta messages via the
 *     injected GameLoopAdapter
 *   - logging
 *   - stopping on victory
 *
 * Everything that mutates game state or produces events lives in
 * `./tick.ts`. That keeps the engine itself trivially testable and
 * runnable inside a Web Worker without pulling WebSocket plumbing.
 */

import type { ServerMessage } from '@conflict-game/shared-types';
import { createRNG } from '@conflict-game/game-logic';
import type { RNG } from '@conflict-game/game-logic';
import type { AIState } from './ai/index';
import type { GameState } from '@conflict-game/shared-types';
import { drainActions } from './action-queue';
import { runTick, computePlayerDelta } from './tick';

export interface GameStateStore {
  getState(sessionId: string): GameState | null;
  setState(sessionId: string, state: GameState): void;
}

/**
 * Transport-agnostic interface the game loop uses to reach players.
 * Server passes a WebSocket-backed implementation; single-player passes an in-process one.
 */
export interface GameLoopAdapter {
  sendToPlayer(playerId: string, message: ServerMessage): void;
  broadcast(sessionId: string, message: ServerMessage): void;
  getPlayerConnections(sessionId: string): { playerId: string; countryCode: string | null }[];
}

export class InMemoryGameStateStore implements GameStateStore {
  private states = new Map<string, GameState>();

  getState(sessionId: string): GameState | null {
    return this.states.get(sessionId) ?? null;
  }

  setState(sessionId: string, state: GameState): void {
    this.states.set(sessionId, state);
  }

  removeState(sessionId: string): void {
    this.states.delete(sessionId);
  }

  getAllSessions(): string[] {
    return [...this.states.keys()];
  }
}

export class GameLoop {
  private intervals = new Map<string, ReturnType<typeof setInterval>>();
  private sessionRngs = new Map<string, RNG>();
  private store: GameStateStore;
  private adapter: GameLoopAdapter;
  private tickIntervalMs: number;
  private aiStatesRef: Map<string, Map<string, AIState>> | null = null;

  constructor(store: GameStateStore, adapter: GameLoopAdapter, tickIntervalMs: number = 10_000) {
    this.store = store;
    this.adapter = adapter;
    this.tickIntervalMs = tickIntervalMs;
  }

  setAIStates(ref: Map<string, Map<string, AIState>>): void {
    this.aiStatesRef = ref;
  }

  get stateStore(): GameStateStore {
    return this.store;
  }

  /**
   * Start ticking a session. `seed` enables deterministic replay — same seed +
   * same action sequence ⇒ identical tick outputs. If omitted, a time-based
   * seed is used (non-reproducible, fine for live online games).
   */
  start(sessionId: string, seed?: number): void {
    if (this.intervals.has(sessionId)) return;
    if (!this.sessionRngs.has(sessionId)) {
      this.sessionRngs.set(sessionId, createRNG(seed ?? Date.now()));
    }
    console.log(`[GameLoop] Starting session ${sessionId}, tick every ${this.tickIntervalMs}ms`);
    const id = setInterval(() => this.tick(sessionId), this.tickIntervalMs);
    this.intervals.set(sessionId, id);
  }

  stop(sessionId: string): void {
    const id = this.intervals.get(sessionId);
    if (id) {
      clearInterval(id);
      this.intervals.delete(sessionId);
      this.sessionRngs.delete(sessionId);
      console.log(`[GameLoop] Stopped session ${sessionId}`);
    }
  }

  pause(sessionId: string): boolean {
    const state = this.store.getState(sessionId);
    if (!state) return false;
    const id = this.intervals.get(sessionId);
    if (id) {
      clearInterval(id);
      this.intervals.delete(sessionId);
    }
    state.session.status = 'paused';
    this.store.setState(sessionId, state);
    console.log(`[GameLoop] Paused session ${sessionId}`);
    return true;
  }

  resume(sessionId: string): boolean {
    const state = this.store.getState(sessionId);
    if (!state || state.session.status !== 'paused') return false;
    state.session.status = 'active';
    this.store.setState(sessionId, state);
    this.start(sessionId);
    console.log(`[GameLoop] Resumed session ${sessionId}`);
    return true;
  }

  isPaused(sessionId: string): boolean {
    const state = this.store.getState(sessionId);
    return state?.session.status === 'paused';
  }

  stopAll(): void {
    for (const [sid] of this.intervals) {
      this.stop(sid);
    }
  }

  private tick(sessionId: string): void {
    const state = this.store.getState(sessionId);
    if (!state || state.session.status !== 'active') return;

    // Per-session RNG — created on first start(), persists across pause/resume.
    let rng = this.sessionRngs.get(sessionId);
    if (!rng) {
      rng = createRNG(Date.now());
      this.sessionRngs.set(sessionId, rng);
    }

    const queuedActions = drainActions(sessionId);
    const aiStates = this.aiStatesRef?.get(sessionId);

    const { countryDeltas, newEvents, actionResults, aiResults, victoryResult } = runTick({
      state,
      sessionId,
      queuedActions,
      aiStates,
      rng,
    });

    // Persist mutated state
    this.store.setState(sessionId, state);

    // Broadcast action_result to each submitter + log
    for (const { playerId, countryCode, action, result } of actionResults) {
      this.adapter.sendToPlayer(playerId, { type: 'action_result', payload: result });
      console.log(
        `[GameLoop] Action ${action.type} by ${countryCode}: ${result.success ? 'OK' : result.message}`
      );
    }

    // Log successful AI actions (same behavior as before)
    for (const { countryCode, action, result } of aiResults) {
      if (result.success) console.log(`[AI] ${countryCode} → ${action.type}: OK`);
    }

    // Stop the loop on victory (before sending deltas so clients still get the final event)
    if (victoryResult?.achieved) {
      console.log(
        `[GameLoop] Game over! Winner: ${victoryResult.winner} by ${victoryResult.condition}`
      );
      this.stop(sessionId);
    }

    // Per-player fog: send each player their fogged view
    const playerConns = this.adapter.getPlayerConnections(sessionId);
    for (const { playerId, countryCode } of playerConns) {
      const playerDelta = computePlayerDelta(state, countryDeltas, newEvents, countryCode, rng);
      this.adapter.sendToPlayer(playerId, { type: 'state_delta', payload: playerDelta });
    }
  }
}
