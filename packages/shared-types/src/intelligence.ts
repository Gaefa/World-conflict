// ── Fog of War & Intelligence System (v0.3) ──

/** How much a player knows about a target country */
export type IntelLevel = 'none' | 'low' | 'medium' | 'high' | 'full';

/** Intelligence accuracy: how much noise is added to observed data */
export const INTEL_ACCURACY: Record<IntelLevel, number> = {
  none: 0.30,   // ±30% error
  low: 0.20,    // ±20% error
  medium: 0.10, // ±10% error
  high: 0.05,   // ±5% error
  full: 0,      // exact data
};

/** Per-country intelligence state (what YOU know about OTHERS) */
export interface IntelligenceState {
  /** Budget allocated to intelligence per tick ($B) */
  intelBudget: number;
  /** Counterintelligence strength 0-100 (how hard you are to spy on) */
  counterIntel: number;
  /** Active disinformation campaigns: what you fake about yourself */
  disinfo: DisinfoOperation[];
  /** SIGINT capability (requires tech 7+): can preview enemy actions */
  sigintActive: boolean;
  /** Dossiers on other countries: what you've gathered */
  dossiers: Record<string, CountryDossier>;
}

/** What you know about a specific country */
export interface CountryDossier {
  /** Current intel level */
  level: IntelLevel;
  /** Intel points accumulated (100 = level up) */
  intelPoints: number;
  /** Active spy operations against this country */
  activeOps: SpyOperation[];
  /** Last tick when intel was updated */
  lastUpdated: number;
  /** Revealed data categories */
  revealed: RevealedCategories;
}

/** Which data categories have been revealed by intelligence */
export interface RevealedCategories {
  economy: boolean;    // GDP, budget, trade balance
  military: boolean;   // army size, tech level, nukes
  resources: boolean;  // production, deficits, stockpiles
  diplomacy: boolean;  // relations, alliances, secret deals
  stability: boolean;  // approval, stability, revolution risk
}

/** Active spy operation */
export interface SpyOperation {
  id: string;
  type: SpyOpType;
  targetCountry: string;
  startedTick: number;
  duration: number;      // ticks remaining
  /** Chance of being caught per tick (0-1) */
  detectionRisk: number;
  /** What category this op reveals */
  reveals: keyof RevealedCategories;
}

export type SpyOpType =
  | 'human_intel'       // HUMINT: slow but reliable, low detection
  | 'signal_intel'      // SIGINT: fast, requires tech 7+, medium detection
  | 'satellite_recon'   // IMINT: reveals military, requires tech 5+
  | 'cyber_espionage'   // fast, high detection, reveals economy/resources
  | 'diplomatic_probe'; // safe, slow, reveals diplomacy

/** Disinformation operation: fake data about yourself */
export interface DisinfoOperation {
  id: string;
  category: keyof RevealedCategories;
  /** Multiplier applied to displayed value (e.g. 1.5 = appear 50% stronger) */
  multiplier: number;
  startedTick: number;
  duration: number; // ticks
}

/** Spy operation configs */
export const SPY_OP_CONFIG: Record<SpyOpType, {
  cost: number;        // $B per tick
  baseDuration: number; // ticks to complete
  detectionRisk: number; // base chance per tick
  reveals: keyof RevealedCategories;
  techRequired: number;
  intelGain: number;   // intel points per tick
}> = {
  human_intel: {
    cost: 2, baseDuration: 6, detectionRisk: 0.05,
    reveals: 'stability', techRequired: 1, intelGain: 8,
  },
  signal_intel: {
    cost: 5, baseDuration: 3, detectionRisk: 0.12,
    reveals: 'military', techRequired: 7, intelGain: 15,
  },
  satellite_recon: {
    cost: 3, baseDuration: 2, detectionRisk: 0.03,
    reveals: 'military', techRequired: 5, intelGain: 10,
  },
  cyber_espionage: {
    cost: 4, baseDuration: 2, detectionRisk: 0.18,
    reveals: 'economy', techRequired: 5, intelGain: 12,
  },
  diplomatic_probe: {
    cost: 1, baseDuration: 4, detectionRisk: 0.02,
    reveals: 'diplomacy', techRequired: 1, intelGain: 5,
  },
};

/** Intel level thresholds (cumulative intel points) */
export const INTEL_THRESHOLDS: Record<IntelLevel, number> = {
  none: 0,
  low: 25,
  medium: 60,
  high: 120,
  full: 200,
};
