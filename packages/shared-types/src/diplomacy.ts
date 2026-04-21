import type { ResourceType } from './country';

export type DiplomacyType =
  | 'alliance'
  | 'war'
  | 'trade_agreement'
  | 'sanction'
  | 'non_aggression'
  | 'ceasefire'
  | 'naval_blockade'
  | 'smuggle_route';

export type DiplomacyStatus = 'proposed' | 'active' | 'rejected' | 'expired' | 'broken';

export interface TradeFlow {
  resource: ResourceType;
  amountPerTick: number;
  direction: 'from_to' | 'to_from'; // from=fromCountry, to=toCountry
  priceModifier: number; // 1.0 = market price, 0.8 = 20% discount, etc.
}

export interface DiplomaticRelation {
  id: string;
  sessionId: string;
  fromCountry: string;
  toCountry: string;
  type: DiplomacyType;
  status: DiplomacyStatus;
  createdAtTick: number;
  expiresAtTick: number | null;
  tradeFlows?: TradeFlow[];             // only for trade_agreement type
  smuggleMethod?: string;               // only for smuggle_route type
  smuggleDetectionChance?: number;      // only for smuggle_route type
}
