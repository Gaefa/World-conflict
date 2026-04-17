// ── v0.4 Tech Tree ──

import techTreeData from './tech-tree.json';

export type TechBranch = 'military' | 'economic' | 'cyber' | 'space' | 'biotech' | 'infrastructure';

export type TechId = string;

export type TechStatus = 'locked' | 'available' | 'researching' | 'completed';

// Static definition of a single technology
export interface TechDefinition {
  id: TechId;
  branch: TechBranch;
  tier: number;               // 1-8 within branch
  name: string;
  description: string;
  icon: string;               // emoji
  cost: number;               // $B
  researchTicks: number;      // ticks to complete
  prerequisites: TechId[];    // same-branch + cross-branch deps
  effects: TechEffect[];
}

export interface TechEffect {
  type: TechEffectType;
  target: string;             // what it modifies
  value: number;
  description: string;
}

export type TechEffectType =
  | 'stat_bonus'           // +X% to a stat
  | 'unlock_action'        // unlocks a new action type
  | 'unlock_processing'    // unlocks a ProcessedResource chain
  | 'reduce_cost'          // reduces cost by X%
  | 'intel_bonus'          // improves intel ops
  | 'unlock_unit_type'     // new army type
  | 'resource_efficiency'  // +X% resource production
  | 'stability_bonus'      // +X stability per tick
  | 'trade_bonus'          // +X% trade income
  | 'defense_bonus';       // +X% defense multiplier

// Per-country tech state (lives on CountryState)
export interface TechnologyState {
  researchedTechs: TechId[];
  activeResearch: ActiveResearch | null;
  bonuses: TechBonuses;
}

export interface ActiveResearch {
  techId: TechId;
  startedTick: number;
  ticksRemaining: number;
  totalTicks: number;
  investedCost: number;
}

// Cached aggregate bonuses from all completed techs
export interface TechBonuses {
  gdpGrowthBonus: number;
  militaryAttackMultiplier: number;
  militaryDefenseMultiplier: number;
  resourceEfficiency: number;
  intelBonus: number;
  stabilityBonus: number;
  tradeIncomeBonus: number;
  cyberPower: number;
  sanctionResilienceBonus: number;
  unlockedActions: string[];
  unlockedProcessing: string[];
}

// Default empty bonuses
export function defaultTechBonuses(): TechBonuses {
  return {
    gdpGrowthBonus: 0,
    militaryAttackMultiplier: 1.0,
    militaryDefenseMultiplier: 1.0,
    resourceEfficiency: 1.0,
    intelBonus: 0,
    stabilityBonus: 0,
    tradeIncomeBonus: 1.0,
    cyberPower: 0,
    sanctionResilienceBonus: 0,
    unlockedActions: [],
    unlockedProcessing: [],
  };
}

// ── Static Tech Tree Registry ──
// Tech definitions live in tech-tree.json (edit-friendly for rebalancing
// without touching TS). Cast is safe because the JSON was generated from /
// validated against TechDefinition; bad edits surface on first read.
export const TECH_TREE: Record<TechId, TechDefinition> = techTreeData as Record<TechId, TechDefinition>;

// Total tech count for progress calculations
export const TOTAL_TECH_COUNT = Object.keys(TECH_TREE).length;

// Get techs by branch
export function getTechsByBranch(branch: TechBranch): TechDefinition[] {
  return Object.values(TECH_TREE)
    .filter(t => t.branch === branch)
    .sort((a, b) => a.tier - b.tier);
}

// All branch names
export const TECH_BRANCHES: { key: TechBranch; label: string; icon: string }[] = [
  { key: 'military', label: 'Military', icon: '\u2694\uFE0F' },
  { key: 'economic', label: 'Economic', icon: '\u{1F4B0}' },
  { key: 'cyber', label: 'Cyber', icon: '\u{1F4BB}' },
  { key: 'space', label: 'Space', icon: '\u{1F680}' },
  { key: 'biotech', label: 'Biotech', icon: '\u{1F9EC}' },
  { key: 'infrastructure', label: 'Infrastructure', icon: '\u{1F3D7}\uFE0F' },
];
