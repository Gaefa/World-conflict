import type { GameState, PlayerAction } from '@conflict-game/shared-types';
import type { RNG } from '@conflict-game/game-logic';
import { DIFFICULTY_MULTIPLIER, computePriorities, type AIState } from './personality';
import { computeEconomicActions, computeResearchAction } from './economic-actions';
import { computeMilitaryActions } from './military-actions';
import { computeDiplomaticActions } from './diplomatic-actions';
import { computeIntelActions } from './intel-actions';

// Re-export the personality module so existing imports keep working.
export type { AIStrategy, AIDifficulty, AIPersonality, AIState } from './personality';
export { assignStrategy, createAIState } from './personality';

// ─── Core AI Decision Engine ─────────────────────────────────────────

export function computeAIActions(
  state: GameState,
  aiState: AIState,
  currentTick: number,
  rng: RNG,
): PlayerAction[] {
  const country = state.countries[aiState.countryCode];
  if (!country) return [];

  const actions: PlayerAction[] = [];
  const p = aiState.personality;
  const diff = DIFFICULTY_MULTIPLIER[aiState.difficulty];

  // AI действует не каждый тик — зависит от difficulty
  const actionInterval = Math.max(1, Math.floor(3 / diff));
  if ((currentTick - aiState.lastActionTick) < actionInterval) return [];

  // Обновляем приоритеты
  aiState.priorities = computePriorities(country, p.strategy);
  aiState.lastActionTick = currentTick;

  // Обновляем списки врагов/союзников
  updateRelationships(state, aiState);

  // ─── Stability Crisis Actions ──────────────────────────────────
  if (country.stability < 30) {
    actions.push({ type: 'propaganda', targetCountry: aiState.countryCode, narrative: 'nationalism' });
    return actions; // В кризисе — только стабилизация
  }

  // ─── Economic Actions ──────────────────────────────────────────
  if (p.economy > 0.4 || country.economy.gdpGrowth < 0) {
    actions.push(...computeEconomicActions(country, p, diff, rng));
  }

  // ─── Military Actions ──────────────────────────────────────────
  if (p.aggression > 0.3) {
    actions.push(...computeMilitaryActions(state, aiState, country, diff, rng));
  }

  // ─── Diplomatic Actions ────────────────────────────────────────
  if (p.diplomacy > 0.3) {
    actions.push(...computeDiplomaticActions(state, aiState, country, currentTick, diff, rng));
  }

  // ─── Research Actions ──────────────────────────────────────────
  if (!country.tech?.activeResearch) {
    const techAction = computeResearchAction(country, p);
    if (techAction) actions.push(techAction);
  }

  // ─── Intelligence Actions ──────────────────────────────────────
  if (p.aggression > 0.4 || p.diplomacy > 0.6) {
    actions.push(...computeIntelActions(state, aiState, country, diff, rng));
  }

  // Лимит действий за тик (easy=1, normal=2, hard=3)
  const maxActions = Math.ceil(2 * diff);
  return actions.slice(0, maxActions);
}

function updateRelationships(state: GameState, aiState: AIState): void {
  aiState.allies = [];
  aiState.enemies = [];

  for (const rel of state.relations) {
    if (rel.status !== 'active') continue;
    const isFrom = rel.fromCountry === aiState.countryCode;
    const isTo = rel.toCountry === aiState.countryCode;
    if (!isFrom && !isTo) continue;

    const other = isFrom ? rel.toCountry : rel.fromCountry;

    if (rel.type === 'war') {
      aiState.enemies.push(other);
    } else if (rel.type === 'alliance' || rel.type === 'trade_agreement') {
      aiState.allies.push(other);
    }
  }
}
