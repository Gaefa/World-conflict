// ── v0.4 Tech Tree ──

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

export const TECH_TREE: Record<TechId, TechDefinition> = {
  // ── MILITARY BRANCH ──
  mil_1: {
    id: 'mil_1', branch: 'military', tier: 1,
    name: 'Advanced Infantry', description: 'Modern infantry equipment and tactics',
    icon: '\u{1F3AF}', cost: 5, researchTicks: 3, prerequisites: [],
    effects: [
      { type: 'stat_bonus', target: 'militaryAttack', value: 0.1, description: 'Attack +10%' },
    ],
  },
  mil_2: {
    id: 'mil_2', branch: 'military', tier: 2,
    name: 'Mechanized Warfare', description: 'Armored vehicles and mobile divisions',
    icon: '\u{1F69C}', cost: 10, researchTicks: 5, prerequisites: ['mil_1'],
    effects: [
      { type: 'stat_bonus', target: 'militaryAttack', value: 0.15, description: 'Attack +15%' },
      { type: 'defense_bonus', target: 'militaryDefense', value: 0.1, description: 'Defense +10%' },
    ],
  },
  mil_3: {
    id: 'mil_3', branch: 'military', tier: 3,
    name: 'Drone Warfare', description: 'Unmanned aerial systems for recon and strike',
    icon: '\u{1F681}', cost: 15, researchTicks: 6, prerequisites: ['mil_2'],
    effects: [
      { type: 'stat_bonus', target: 'militaryAttack', value: 0.2, description: 'Attack +20%' },
      { type: 'intel_bonus', target: 'intelGain', value: 2, description: 'Intel +2 from military ops' },
    ],
  },
  mil_4: {
    id: 'mil_4', branch: 'military', tier: 4,
    name: 'Hypersonic Missiles', description: 'Mach 5+ precision strike capability',
    icon: '\u{1F680}', cost: 25, researchTicks: 8, prerequisites: ['mil_3'],
    effects: [
      { type: 'stat_bonus', target: 'militaryAttack', value: 0.25, description: 'Attack +25%' },
    ],
  },
  mil_5: {
    id: 'mil_5', branch: 'military', tier: 5,
    name: 'Stealth Technology', description: 'Radar-evading aircraft and naval vessels',
    icon: '\u{1F47B}', cost: 30, researchTicks: 10, prerequisites: ['mil_4', 'cyber_2'],
    effects: [
      { type: 'defense_bonus', target: 'militaryDefense', value: 0.2, description: 'Defense +20%' },
      { type: 'stat_bonus', target: 'militaryAttack', value: 0.15, description: 'Attack +15%' },
    ],
  },
  mil_6: {
    id: 'mil_6', branch: 'military', tier: 6,
    name: 'Naval Supremacy', description: 'Carrier groups and maritime dominance',
    icon: '\u2693', cost: 35, researchTicks: 12, prerequisites: ['mil_5'],
    effects: [
      { type: 'stat_bonus', target: 'militaryAttack', value: 0.15, description: 'Attack +15%' },
      { type: 'trade_bonus', target: 'tradeIncome', value: 0.1, description: 'Trade +10% (sea lanes)' },
    ],
  },
  mil_7: {
    id: 'mil_7', branch: 'military', tier: 7,
    name: 'Strategic Bombers', description: 'Long-range strategic bombing capability',
    icon: '\u2708\uFE0F', cost: 40, researchTicks: 14, prerequisites: ['mil_6'],
    effects: [
      { type: 'stat_bonus', target: 'militaryAttack', value: 0.3, description: 'Attack +30%' },
    ],
  },
  mil_8: {
    id: 'mil_8', branch: 'military', tier: 8,
    name: 'Nuclear Deterrent', description: 'Full nuclear triad capability',
    icon: '\u2622\uFE0F', cost: 50, researchTicks: 18, prerequisites: ['mil_7', 'infra_4'],
    effects: [
      { type: 'defense_bonus', target: 'militaryDefense', value: 0.3, description: 'Defense +30% (deterrence)' },
      { type: 'stability_bonus', target: 'stability', value: 0.5, description: 'Stability +0.5/tick' },
    ],
  },

  // ── ECONOMIC BRANCH ──
  econ_1: {
    id: 'econ_1', branch: 'economic', tier: 1,
    name: 'Digital Banking', description: 'Modern financial infrastructure',
    icon: '\u{1F4B3}', cost: 5, researchTicks: 3, prerequisites: [],
    effects: [
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.3, description: 'GDP growth +0.3%' },
    ],
  },
  econ_2: {
    id: 'econ_2', branch: 'economic', tier: 2,
    name: 'Trade Automation', description: 'Automated customs and logistics',
    icon: '\u{1F4E6}', cost: 8, researchTicks: 4, prerequisites: ['econ_1'],
    effects: [
      { type: 'trade_bonus', target: 'tradeIncome', value: 0.15, description: 'Trade income +15%' },
    ],
  },
  econ_3: {
    id: 'econ_3', branch: 'economic', tier: 3,
    name: 'Special Economic Zones', description: 'Free trade zones boosting foreign investment',
    icon: '\u{1F3ED}', cost: 12, researchTicks: 5, prerequisites: ['econ_2'],
    effects: [
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.5, description: 'GDP growth +0.5%' },
      { type: 'trade_bonus', target: 'tradeIncome', value: 0.1, description: 'Trade income +10%' },
    ],
  },
  econ_4: {
    id: 'econ_4', branch: 'economic', tier: 4,
    name: 'Green Energy', description: 'Renewable energy transition',
    icon: '\u{1F33F}', cost: 20, researchTicks: 8, prerequisites: ['econ_3', 'infra_2'],
    effects: [
      { type: 'resource_efficiency', target: 'energy', value: 0.2, description: 'Energy efficiency +20%' },
      { type: 'stability_bonus', target: 'stability', value: 0.3, description: 'Stability +0.3/tick' },
    ],
  },
  econ_5: {
    id: 'econ_5', branch: 'economic', tier: 5,
    name: 'Advanced Manufacturing', description: 'Automated precision manufacturing',
    icon: '\u2699\uFE0F', cost: 25, researchTicks: 10, prerequisites: ['econ_4'],
    effects: [
      { type: 'resource_efficiency', target: 'industrial', value: 0.25, description: 'Industrial output +25%' },
      { type: 'unlock_processing', target: 'weaponsComponents', value: 1, description: 'Unlocks weapons components' },
    ],
  },
  econ_6: {
    id: 'econ_6', branch: 'economic', tier: 6,
    name: 'Financial Instruments', description: 'Complex derivatives and sovereign wealth funds',
    icon: '\u{1F4C8}', cost: 30, researchTicks: 12, prerequisites: ['econ_5'],
    effects: [
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.8, description: 'GDP growth +0.8%' },
      { type: 'stat_bonus', target: 'sanctionResilience', value: 15, description: 'Sanction resilience +15' },
    ],
  },

  // ── CYBER BRANCH ──
  cyber_1: {
    id: 'cyber_1', branch: 'cyber', tier: 1,
    name: 'Basic Encryption', description: 'Secure communications infrastructure',
    icon: '\u{1F510}', cost: 5, researchTicks: 3, prerequisites: [],
    effects: [
      { type: 'intel_bonus', target: 'counterIntel', value: 5, description: 'Counter-intel +5' },
    ],
  },
  cyber_2: {
    id: 'cyber_2', branch: 'cyber', tier: 2,
    name: 'Network Defense', description: 'National firewall and intrusion detection',
    icon: '\u{1F6E1}\uFE0F', cost: 10, researchTicks: 5, prerequisites: ['cyber_1'],
    effects: [
      { type: 'intel_bonus', target: 'counterIntel', value: 10, description: 'Counter-intel +10' },
      { type: 'defense_bonus', target: 'cyberDefense', value: 0.15, description: 'Cyber defense +15%' },
    ],
  },
  cyber_3: {
    id: 'cyber_3', branch: 'cyber', tier: 3,
    name: 'Offensive Cyber', description: 'Cyber attack and infiltration capabilities',
    icon: '\u{1F5A5}\uFE0F', cost: 15, researchTicks: 7, prerequisites: ['cyber_2'],
    effects: [
      { type: 'unlock_action', target: 'cyber_attack', value: 1, description: 'Unlocks cyber attacks' },
      { type: 'stat_bonus', target: 'cyberPower', value: 3, description: 'Cyber power +3' },
    ],
  },
  cyber_4: {
    id: 'cyber_4', branch: 'cyber', tier: 4,
    name: 'AI Surveillance', description: 'AI-powered intelligence analysis',
    icon: '\u{1F916}', cost: 20, researchTicks: 8, prerequisites: ['cyber_3'],
    effects: [
      { type: 'intel_bonus', target: 'intelGain', value: 5, description: 'Intel gain +5 per op' },
      { type: 'stat_bonus', target: 'cyberPower', value: 3, description: 'Cyber power +3' },
    ],
  },
  cyber_5: {
    id: 'cyber_5', branch: 'cyber', tier: 5,
    name: 'Quantum Computing', description: 'Quantum-enabled cryptography and computing',
    icon: '\u{1F52E}', cost: 35, researchTicks: 12, prerequisites: ['cyber_4', 'econ_5'],
    effects: [
      { type: 'stat_bonus', target: 'cyberPower', value: 5, description: 'Cyber power +5' },
      { type: 'intel_bonus', target: 'intelGain', value: 5, description: 'Intel gain +5' },
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.3, description: 'GDP growth +0.3%' },
    ],
  },
  cyber_6: {
    id: 'cyber_6', branch: 'cyber', tier: 6,
    name: 'Full Spectrum Cyber', description: 'Total information warfare dominance',
    icon: '\u26A1', cost: 45, researchTicks: 15, prerequisites: ['cyber_5'],
    effects: [
      { type: 'stat_bonus', target: 'cyberPower', value: 5, description: 'Cyber power +5' },
      { type: 'intel_bonus', target: 'counterIntel', value: 15, description: 'Counter-intel +15' },
      { type: 'unlock_action', target: 'full_cyber_war', value: 1, description: 'Unlocks full cyber warfare' },
    ],
  },

  // ── SPACE BRANCH ──
  space_1: {
    id: 'space_1', branch: 'space', tier: 1,
    name: 'Satellite Launch', description: 'Basic orbital launch capability',
    icon: '\u{1F6F0}\uFE0F', cost: 10, researchTicks: 5, prerequisites: [],
    effects: [
      { type: 'intel_bonus', target: 'intelGain', value: 2, description: 'Intel gain +2' },
    ],
  },
  space_2: {
    id: 'space_2', branch: 'space', tier: 2,
    name: 'GPS Network', description: 'Global positioning and navigation system',
    icon: '\u{1F4E1}', cost: 15, researchTicks: 6, prerequisites: ['space_1'],
    effects: [
      { type: 'stat_bonus', target: 'militaryAttack', value: 0.1, description: 'Military accuracy +10%' },
      { type: 'trade_bonus', target: 'tradeIncome', value: 0.05, description: 'Trade +5% (logistics)' },
    ],
  },
  space_3: {
    id: 'space_3', branch: 'space', tier: 3,
    name: 'Space Reconnaissance', description: 'Spy satellites and orbital imaging',
    icon: '\u{1F52D}', cost: 20, researchTicks: 8, prerequisites: ['space_2'],
    effects: [
      { type: 'intel_bonus', target: 'intelGain', value: 5, description: 'Intel gain +5' },
      { type: 'unlock_action', target: 'satellite_spy', value: 1, description: 'Improved satellite ops' },
    ],
  },
  space_4: {
    id: 'space_4', branch: 'space', tier: 4,
    name: 'Anti-Satellite Weapons', description: 'ASAT missiles to deny enemy space assets',
    icon: '\u{1F4A5}', cost: 30, researchTicks: 10, prerequisites: ['space_3', 'mil_4'],
    effects: [
      { type: 'defense_bonus', target: 'spaceDefense', value: 0.2, description: 'Can destroy enemy satellites' },
      { type: 'stat_bonus', target: 'militaryAttack', value: 0.15, description: 'Attack +15%' },
    ],
  },
  space_5: {
    id: 'space_5', branch: 'space', tier: 5,
    name: 'Space Station', description: 'Permanent orbital research platform',
    icon: '\u{1F30D}', cost: 40, researchTicks: 14, prerequisites: ['space_4'],
    effects: [
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.5, description: 'GDP growth +0.5%' },
      { type: 'stability_bonus', target: 'stability', value: 0.5, description: 'Stability +0.5/tick (prestige)' },
      { type: 'intel_bonus', target: 'intelGain', value: 3, description: 'Intel +3' },
    ],
  },

  // ── BIOTECH BRANCH ──
  bio_1: {
    id: 'bio_1', branch: 'biotech', tier: 1,
    name: 'Genetic Research', description: 'Genomics and gene therapy foundations',
    icon: '\u{1F9EC}', cost: 8, researchTicks: 4, prerequisites: [],
    effects: [
      { type: 'stability_bonus', target: 'stability', value: 0.2, description: 'Stability +0.2/tick (healthcare)' },
    ],
  },
  bio_2: {
    id: 'bio_2', branch: 'biotech', tier: 2,
    name: 'Vaccine Programs', description: 'National vaccination infrastructure',
    icon: '\u{1F489}', cost: 10, researchTicks: 5, prerequisites: ['bio_1'],
    effects: [
      { type: 'stability_bonus', target: 'stability', value: 0.3, description: 'Stability +0.3/tick' },
      { type: 'stat_bonus', target: 'approval', value: 5, description: 'Approval +5' },
    ],
  },
  bio_3: {
    id: 'bio_3', branch: 'biotech', tier: 3,
    name: 'Biodefense', description: 'Protection against biological threats',
    icon: '\u{1F9EA}', cost: 15, researchTicks: 7, prerequisites: ['bio_2'],
    effects: [
      { type: 'defense_bonus', target: 'bioDefense', value: 0.2, description: 'Bio attack defense +20%' },
      { type: 'stability_bonus', target: 'stability', value: 0.2, description: 'Stability +0.2/tick' },
    ],
  },
  bio_4: {
    id: 'bio_4', branch: 'biotech', tier: 4,
    name: 'Agricultural Biotech', description: 'GMOs and advanced farming techniques',
    icon: '\u{1F33E}', cost: 18, researchTicks: 6, prerequisites: ['bio_3'],
    effects: [
      { type: 'resource_efficiency', target: 'agriculture', value: 0.3, description: 'Food production +30%' },
      { type: 'unlock_processing', target: 'fertilizer', value: 1, description: 'Improved fertilizer production' },
    ],
  },
  bio_5: {
    id: 'bio_5', branch: 'biotech', tier: 5,
    name: 'Synthetic Biology', description: 'Programmable organisms and synthetic materials',
    icon: '\u{1F52C}', cost: 35, researchTicks: 12, prerequisites: ['bio_4', 'cyber_4'],
    effects: [
      { type: 'unlock_processing', target: 'pharmaceuticals', value: 1, description: 'Advanced pharmaceuticals' },
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.5, description: 'GDP growth +0.5%' },
      { type: 'resource_efficiency', target: 'industrial', value: 0.15, description: 'Industrial +15% (biomaterials)' },
    ],
  },

  // ── INFRASTRUCTURE BRANCH ──
  infra_1: {
    id: 'infra_1', branch: 'infrastructure', tier: 1,
    name: 'Power Grid', description: 'Modern electrical grid and power distribution',
    icon: '\u{1F50C}', cost: 8, researchTicks: 4, prerequisites: [],
    effects: [
      { type: 'resource_efficiency', target: 'energy', value: 0.15, description: 'Energy efficiency +15%' },
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.2, description: 'GDP growth +0.2%' },
    ],
  },
  infra_2: {
    id: 'infra_2', branch: 'infrastructure', tier: 2,
    name: 'Highway Network', description: 'National highway and rail infrastructure',
    icon: '\u{1F6E3}\uFE0F', cost: 12, researchTicks: 5, prerequisites: ['infra_1'],
    effects: [
      { type: 'trade_bonus', target: 'tradeIncome', value: 0.1, description: 'Trade income +10%' },
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.3, description: 'GDP growth +0.3%' },
    ],
  },
  infra_3: {
    id: 'infra_3', branch: 'infrastructure', tier: 3,
    name: '5G Deployment', description: 'Nationwide 5G telecommunications',
    icon: '\u{1F4F6}', cost: 15, researchTicks: 6, prerequisites: ['infra_2'],
    effects: [
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.4, description: 'GDP growth +0.4%' },
      { type: 'stat_bonus', target: 'cyberPower', value: 2, description: 'Cyber power +2' },
    ],
  },
  infra_4: {
    id: 'infra_4', branch: 'infrastructure', tier: 4,
    name: 'Smart Cities', description: 'IoT-connected urban infrastructure',
    icon: '\u{1F3D9}\uFE0F', cost: 25, researchTicks: 8, prerequisites: ['infra_3', 'cyber_3'],
    effects: [
      { type: 'stability_bonus', target: 'stability', value: 0.4, description: 'Stability +0.4/tick' },
      { type: 'stat_bonus', target: 'gdpGrowth', value: 0.5, description: 'GDP growth +0.5%' },
      { type: 'stat_bonus', target: 'approval', value: 5, description: 'Approval +5' },
    ],
  },
  infra_5: {
    id: 'infra_5', branch: 'infrastructure', tier: 5,
    name: 'Underground Bunkers', description: 'Strategic command and civilian shelters',
    icon: '\u{1F3DA}\uFE0F', cost: 30, researchTicks: 10, prerequisites: ['infra_4'],
    effects: [
      { type: 'defense_bonus', target: 'civilianDefense', value: 0.25, description: 'Civilian defense +25%' },
      { type: 'stability_bonus', target: 'stability', value: 0.3, description: 'Stability +0.3/tick (security)' },
    ],
  },
  infra_6: {
    id: 'infra_6', branch: 'infrastructure', tier: 6,
    name: 'Logistics Networks', description: 'AI-optimized supply chains and distribution',
    icon: '\u{1F4E6}', cost: 35, researchTicks: 12, prerequisites: ['infra_5', 'econ_5'],
    effects: [
      { type: 'resource_efficiency', target: 'all', value: 0.15, description: 'All resource efficiency +15%' },
      { type: 'trade_bonus', target: 'tradeIncome', value: 0.15, description: 'Trade income +15%' },
      { type: 'stat_bonus', target: 'sanctionResilience', value: 10, description: 'Sanction resilience +10' },
    ],
  },
};

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
