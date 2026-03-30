export type DiplomacyType =
  | 'alliance'
  | 'war'
  | 'trade_agreement'
  | 'sanction'
  | 'non_aggression'
  | 'ceasefire';

export type DiplomacyStatus = 'proposed' | 'active' | 'rejected' | 'expired' | 'broken';

export interface DiplomaticRelation {
  id: string;
  sessionId: string;
  fromCountry: string;
  toCountry: string;
  type: DiplomacyType;
  status: DiplomacyStatus;
  createdAtTick: number;
  expiresAtTick: number | null;
}
