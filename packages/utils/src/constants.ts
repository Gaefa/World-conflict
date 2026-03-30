export const SEVERITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
  critical: '#dc2626',
} as const;

export const ARMY_TYPE_LABELS: Record<string, string> = {
  infantry: 'Infantry',
  armored: 'Armored',
  naval: 'Naval',
  airforce: 'Air Force',
  special_ops: 'Special Ops',
};

export const DIPLOMACY_TYPE_LABELS: Record<string, string> = {
  alliance: 'Alliance',
  war: 'War',
  trade_agreement: 'Trade Agreement',
  sanction: 'Sanction',
  non_aggression: 'Non-Aggression Pact',
  ceasefire: 'Ceasefire',
};

export const INDEX_OF_POWER_WEIGHTS = {
  gdp: 0.25,
  military: 0.25,
  diplomacy: 0.20,
  technology: 0.15,
  stability: 0.15,
} as const;

export const GAME_DEFAULTS = {
  tickIntervalMs: 10_000,
  maxPlayers: 30,
  sessionDurationTicks: 20_160, // ~2 weeks at 10s ticks
  saveIntervalMs: 30_000,
} as const;

export const REGION_NAMES = [
  'North America',
  'South America',
  'Western Europe',
  'Eastern Europe',
  'Middle East',
  'North Africa',
  'Sub-Saharan Africa',
  'Central Asia',
  'South Asia',
  'East Asia',
  'Southeast Asia',
  'Oceania',
] as const;
