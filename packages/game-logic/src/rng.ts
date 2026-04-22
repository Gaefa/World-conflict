/**
 * Seeded random number generator for deterministic ticks.
 *
 * `RNG` is just `() => number` in [0, 1) — same contract as Math.random,
 * so call sites are a 1:1 replacement. Every stateful game function that
 * needs randomness should take `rng: RNG` as a parameter rather than
 * calling `Math.random()` directly. That keeps ticks pure and replayable:
 * same state + same actions + same seed ⇒ same result.
 *
 * Seed plumbing:
 *   - `GameLoop.start(sessionId, seed?)` creates one RNG per session
 *     via `createRNG(seed)`.
 *   - The same RNG is threaded through `processAction`, tick helpers,
 *     AI decisions, and random-event generation for that session.
 *   - If no seed is provided, `GameLoop` generates one from `Date.now()`
 *     and stores it on the session so replays can be reconstructed.
 */

export type RNG = () => number;

/**
 * mulberry32 — a small, fast, well-distributed seedable PRNG. Adequate
 * for gameplay randomness (AI decisions, combat rolls, event spawns).
 * Not cryptographically secure — don't use for anti-cheat signing.
 *
 * @param seed any 32-bit integer; different seeds produce independent
 *             non-correlated sequences.
 */
export function createRNG(seed: number): RNG {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Non-deterministic RNG for tests / utility code that explicitly does
 * not care about replayability (UI noise, uuid fallbacks). Gameplay
 * code should always receive an injected seeded RNG instead.
 */
export const defaultRNG: RNG = Math.random;
