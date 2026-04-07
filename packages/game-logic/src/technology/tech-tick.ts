import type {
  GameState,
  GameEvent,
  TechnologyState,
  TechId,
  TechBonuses,
  TechDefinition,
  TechStatus,
} from '@conflict-game/shared-types';
import { TECH_TREE, defaultTechBonuses } from '@conflict-game/shared-types';

export interface TechTickResult {
  events: GameEvent[];
}

/**
 * Process technology research for all countries each tick.
 * - Decrements activeResearch timers
 * - Completes research, recomputes bonuses
 * - Emits tech_completed events
 */
export function processTechTick(state: GameState): TechTickResult {
  const events: GameEvent[] = [];

  for (const [code, country] of Object.entries(state.countries)) {
    if (!country.tech) continue;
    const { tech } = country;

    if (!tech.activeResearch) continue;

    // Decrement remaining ticks
    tech.activeResearch.ticksRemaining--;

    if (tech.activeResearch.ticksRemaining <= 0) {
      const completedTechId = tech.activeResearch.techId;
      const techDef = TECH_TREE[completedTechId];

      // Complete research
      tech.researchedTechs.push(completedTechId);
      tech.activeResearch = null;

      // Recompute bonuses
      tech.bonuses = computeTechBonuses(tech.researchedTechs);

      // Update techLevel based on total researched
      country.techLevel = Math.min(10, 1 + Math.floor(tech.researchedTechs.length / 4));

      // Emit event
      if (techDef) {
        events.push({
          id: `tech-${code}-${completedTechId}-${state.session.currentTick}`,
          sessionId: state.session.id,
          type: 'tech_completed',
          tick: state.session.currentTick,
          severity: 'medium',
          title: `${techDef.name} researched`,
          description: `${code} completed research: ${techDef.name}`,
          involvedCountries: [code],
          data: { techId: completedTechId, branch: techDef.branch },
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return { events };
}

/**
 * Compute aggregate tech bonuses from all completed techs.
 */
export function computeTechBonuses(researchedTechs: TechId[]): TechBonuses {
  const bonuses = defaultTechBonuses();

  for (const techId of researchedTechs) {
    const def = TECH_TREE[techId];
    if (!def) continue;

    for (const effect of def.effects) {
      switch (effect.type) {
        case 'stat_bonus':
          if (effect.target === 'militaryAttack') bonuses.militaryAttackMultiplier += effect.value;
          else if (effect.target === 'gdpGrowth') bonuses.gdpGrowthBonus += effect.value;
          else if (effect.target === 'cyberPower') bonuses.cyberPower += effect.value;
          else if (effect.target === 'sanctionResilience') bonuses.sanctionResilienceBonus += effect.value;
          break;
        case 'defense_bonus':
          if (effect.target === 'militaryDefense') bonuses.militaryDefenseMultiplier += effect.value;
          break;
        case 'trade_bonus':
          bonuses.tradeIncomeBonus += effect.value;
          break;
        case 'resource_efficiency':
          bonuses.resourceEfficiency += effect.value;
          break;
        case 'intel_bonus':
          bonuses.intelBonus += effect.value;
          break;
        case 'stability_bonus':
          bonuses.stabilityBonus += effect.value;
          break;
        case 'unlock_action':
          bonuses.unlockedActions.push(effect.target);
          break;
        case 'unlock_processing':
          bonuses.unlockedProcessing.push(effect.target);
          break;
        case 'reduce_cost':
          // Could add specific cost reduction tracking later
          break;
        case 'unlock_unit_type':
          break;
      }
    }
  }

  return bonuses;
}

/**
 * Check if a tech can be researched given current state.
 */
export function canResearchTech(tech: TechnologyState, techId: TechId): boolean {
  const def = TECH_TREE[techId];
  if (!def) return false;
  if (tech.researchedTechs.includes(techId)) return false;
  if (tech.activeResearch) return false;
  return def.prerequisites.every(prereq => tech.researchedTechs.includes(prereq));
}

/**
 * Get the status of a tech for a given country's tech state.
 */
export function getTechStatus(tech: TechnologyState, techId: TechId): TechStatus {
  if (tech.researchedTechs.includes(techId)) return 'completed';
  if (tech.activeResearch?.techId === techId) return 'researching';
  const def = TECH_TREE[techId];
  if (!def) return 'locked';
  if (def.prerequisites.every(p => tech.researchedTechs.includes(p))) return 'available';
  return 'locked';
}

/**
 * Get starting techs for a country based on its initial techLevel.
 * Higher techLevel = more tier-1 and tier-2 techs pre-completed.
 */
export function getStartingTechs(techLevel: number): TechId[] {
  const allTechs = Object.values(TECH_TREE).sort((a, b) => a.tier - b.tier);
  const techs: TechId[] = [];

  // techLevel 1-2: no starting techs
  // techLevel 3-4: tier 1 in 2-3 branches
  // techLevel 5-6: tier 1-2 in all branches
  // techLevel 7-8: tier 1-3 in all branches
  // techLevel 9-10: tier 1-4 in most branches

  const maxTier = Math.max(0, Math.floor((techLevel - 1) / 2));

  if (maxTier <= 0) return techs;

  // Add techs up to maxTier, but need to respect prerequisites
  // Simple approach: add all techs at tier <= maxTier whose prereqs are satisfied
  let changed = true;
  while (changed) {
    changed = false;
    for (const tech of allTechs) {
      if (tech.tier > maxTier) continue;
      if (techs.includes(tech.id)) continue;
      if (tech.prerequisites.every(p => techs.includes(p))) {
        techs.push(tech.id);
        changed = true;
      }
    }
  }

  return techs;
}
