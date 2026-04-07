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
  | 'cultural_event'
  | 'supply_shock'
  | 'price_spike'
  | 'stockpile_depleted'
  | 'trade_disrupted'
  | 'contraband_discovered'
  | 'resource_theft_detected'
  | 'price_manipulation'
  // Intelligence (v0.3)
  | 'spy_caught'
  | 'spy_success'
  | 'intel_breakthrough'
  | 'disinfo_detected'
  | 'sigint_intercept'
  // Tech tree (v0.4)
  | 'tech_completed'
  | 'tech_started';

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
