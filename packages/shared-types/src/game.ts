import type { CountryState, ResourceType, ProcessingChain } from './country.js';
import type { Army } from './military.js';
import type { DiplomaticRelation } from './diplomacy.js';
import type { GameEvent } from './events.js';

export type GameSessionStatus = 'lobby' | 'starting' | 'active' | 'paused' | 'finished';

export interface GameSettings {
  maxPlayers: number;
  tickIntervalMs: number;         // default 10000
  sessionDurationTicks: number;   // how many ticks until game ends
  speed: number;                  // 1x, 2x, 4x multiplier
  allowAI: boolean;
  victoryConditions: VictoryCondition[];
}

export type VictoryCondition =
  | 'domination'
  | 'economic_hegemony'
  | 'diplomatic'
  | 'technological'
  | 'survival';

export interface GameSession {
  id: string;
  name: string;
  hostPlayerId: string;
  status: GameSessionStatus;
  settings: GameSettings;
  currentTick: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Player {
  id: string;
  userId: string;
  username: string;
  sessionId: string;
  countryCode: string | null; // null until country selected
  isAI: boolean;
  isReady: boolean;
  isOnline: boolean;
  joinedAt: string;
}

export interface ResourceMarket {
  prices: Record<string, number>;        // ResourceType → $/unit (base=100)
  globalSupply: Record<string, number>;  // ResourceType → total production
  globalDemand: Record<string, number>;  // ResourceType → total consumption
}

export interface GameState {
  session: GameSession;
  players: Player[];
  countries: Record<string, CountryState>;  // keyed by country code
  armies: Army[];
  relations: DiplomaticRelation[];
  events: GameEvent[];
  tensionIndex: number;         // 0-100 global tension
  resourceMarket: ResourceMarket;
  processingChains: ProcessingChain[];   // global registry of processing recipes
}

export interface GameStateDelta {
  tick: number;
  countries?: Partial<Record<string, Partial<CountryState>>>;
  armies?: ArmyDelta[];
  relations?: DiplomaticRelation[];
  events?: GameEvent[];
  tensionIndex?: number;
  removedArmyIds?: string[];
  resourceMarket?: ResourceMarket;
}

export interface ArmyDelta {
  id: string;
  changes: Partial<Army>;
}
