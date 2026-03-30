export type GameEventType =
  | 'war_declared'
  | 'peace_treaty'
  | 'alliance_formed'
  | 'alliance_broken'
  | 'battle_result'
  | 'trade_agreement'
  | 'sanction_imposed'
  | 'sanction_lifted'
  | 'army_moved'
  | 'army_created'
  | 'army_destroyed'
  | 'revolution'
  | 'coup'
  | 'economic_crisis'
  | 'economic_boom'
  | 'technology_breakthrough'
  | 'un_vote'
  | 'player_joined'
  | 'player_left'
  | 'victory_achieved'
  | 'civil_unrest'
  | 'natural_disaster'
  | 'political_scandal'
  | 'diplomatic_incident'
  | 'resource_discovery'
  | 'pandemic'
  | 'military_incident'
  | 'cultural_event';

export type EventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface GameEvent {
  id: string;
  sessionId: string;
  tick: number;
  type: GameEventType;
  severity: EventSeverity;
  title: string;
  description: string;
  involvedCountries: string[];
  data: Record<string, unknown>;
  createdAt: string;
}
