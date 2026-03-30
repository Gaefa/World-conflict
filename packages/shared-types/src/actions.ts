/** All possible player actions sent to the server */
export type PlayerAction =
  | MoveArmyAction
  | CreateArmyAction
  | DeclareWarAction
  | ProposePeaceAction
  | ProposeAllianceAction
  | ProposeSanctionAction
  | ProposeTradeAction
  | SetTaxRateAction
  | AllocateBudgetAction
  | ResearchTechAction
  | AcceptProposalAction
  | RejectProposalAction
  // Military operations
  | AirstrikeAction
  | InvasionAction
  | NavalBlockadeAction
  // Covert / hybrid warfare
  | ProxyWarAction
  | InciteRebellionAction
  | SabotageAction
  | CyberAttackAction
  | CoupAttemptAction
  // Information warfare
  | PropagandaAction
  | FalseFlagAction
  // Arms
  | ArmsDealAction
  // Sanction evasion
  | SanctionEvasionAction;

// ── Existing actions ──

export interface MoveArmyAction {
  type: 'move_army';
  armyId: string;
  targetLat: number;
  targetLng: number;
}

export interface CreateArmyAction {
  type: 'create_army';
  armyType: string;
  size: number;
  latitude: number;
  longitude: number;
  name: string;
}

export interface DeclareWarAction {
  type: 'declare_war';
  targetCountry: string;
}

export interface ProposePeaceAction {
  type: 'propose_peace';
  targetCountry: string;
}

export interface ProposeAllianceAction {
  type: 'propose_alliance';
  targetCountry: string;
}

export interface ProposeSanctionAction {
  type: 'propose_sanction';
  targetCountry: string;
}

export interface ProposeTradeAction {
  type: 'propose_trade';
  targetCountry: string;
  resource: string;
  amount: number;
}

export interface SetTaxRateAction {
  type: 'set_tax_rate';
  rate: number; // 0-1
}

export interface AllocateBudgetAction {
  type: 'allocate_budget';
  category: 'military' | 'economy' | 'technology' | 'social';
  amount: number;
}

export interface ResearchTechAction {
  type: 'research_tech';
  category: 'military' | 'economy' | 'cyber' | 'space';
}

export interface AcceptProposalAction {
  type: 'accept_proposal';
  relationId: string;
}

export interface RejectProposalAction {
  type: 'reject_proposal';
  relationId: string;
}

// ── Military operations ──

export interface AirstrikeAction {
  type: 'airstrike';
  targetCountry: string;
  intensity: 'surgical' | 'conventional' | 'carpet';  // масштаб удара
}

export interface InvasionAction {
  type: 'invasion';
  targetCountry: string;
  committedForces: number;  // % от армии (0.1 - 1.0)
}

export interface NavalBlockadeAction {
  type: 'naval_blockade';
  targetCountry: string;
}

// ── Covert / hybrid warfare ──

export interface ProxyWarAction {
  type: 'proxy_war';
  targetCountry: string;
  funding: number;  // $B вложено в повстанцев
}

export interface InciteRebellionAction {
  type: 'incite_rebellion';
  targetCountry: string;
}

export interface SabotageAction {
  type: 'sabotage';
  targetCountry: string;
  target: 'infrastructure' | 'military' | 'energy' | 'communications';
}

export interface CyberAttackAction {
  type: 'cyber_attack';
  targetCountry: string;
  target: 'government' | 'financial' | 'military' | 'infrastructure';
}

export interface CoupAttemptAction {
  type: 'coup_attempt';
  targetCountry: string;
}

// ── Information warfare ──

export interface PropagandaAction {
  type: 'propaganda';
  targetCountry: string;
  narrative: 'anti_government' | 'nationalism' | 'separatism' | 'economic_fear';
}

export interface FalseFlagAction {
  type: 'false_flag';
  targetCountry: string;       // кого атакуем
  framedCountry: string;       // на кого вешаем
  operation: 'terrorist_attack' | 'border_incident' | 'cyber_attack';
}

// ── Arms ──

export interface ArmsDealAction {
  type: 'arms_deal';
  targetCountry: string;
  amount: number;  // $B
}

// ── Sanction evasion ──

export interface SanctionEvasionAction {
  type: 'sanction_evasion';
  method: 'shadow_fleet' | 'crypto_bypass' | 'parallel_import' | 'import_substitution';
}

// ── Result types ──

export interface ActionResult {
  success: boolean;
  action: PlayerAction;
  message: string;
  effects: ActionEffect[];
}

export interface ActionEffect {
  description: string;
  known: boolean;      // false = "???" until resolved
  value?: string;      // "+15% GDP" etc
}
