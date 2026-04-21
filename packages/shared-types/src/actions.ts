import type { ResourceType } from './country';
import type { SpyOpType, RevealedCategories } from './intelligence';

/** All possible player actions sent to the server */
export type PlayerAction =
  | MoveArmyAction
  | CreateArmyAction
  | DeclareWarAction
  | ProposePeaceAction
  | ProposeAllianceAction
  | ProposeSanctionAction
  | ProposeTradeAction
  | CounterTradeAction
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
  | SanctionEvasionAction
  // Resource system (v0.2)
  | SmuggleAction
  | ResourceTheftAction
  | BuildStockpileAction
  | ManipulatePriceAction
  // Intelligence (v0.3)
  | LaunchSpyOpAction
  | BoostCounterIntelAction
  | LaunchDisinfoAction
  | SetIntelBudgetAction
  // Tech tree (v0.4)
  | CancelResearchAction;

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

// ── Trade (Civ 5-7 style) ──

export interface TradeItem {
  resource: ResourceType;
  amount: number;          // units/month
  priceModifier?: number;  // 0.5 = 50% discount, 1.5 = 50% markup. Default 1.0 (market price)
}

export interface ProposeTradeAction {
  type: 'propose_trade';
  targetCountry: string;
  offers: TradeItem[];     // what you give
  requests: TradeItem[];   // what you want
  duration?: number;       // months, default 12
}

export interface CounterTradeAction {
  type: 'counter_trade';
  relationId: string;      // ID of pending trade_agreement
  offers: TradeItem[];
  requests: TradeItem[];
}

// ── Economy ──

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
  category?: 'military' | 'economy' | 'cyber' | 'space'; // v0.1 legacy (ignored if techId set)
  techId?: string;                                         // v0.4 specific tech
}

export interface CancelResearchAction {
  type: 'cancel_research';
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
  intensity: 'surgical' | 'conventional' | 'carpet';
}

export interface InvasionAction {
  type: 'invasion';
  targetCountry: string;
  committedForces: number;  // % of army (0.1 - 1.0)
}

export interface NavalBlockadeAction {
  type: 'naval_blockade';
  targetCountry: string;
}

// ── Covert / hybrid warfare ──

export interface ProxyWarAction {
  type: 'proxy_war';
  targetCountry: string;
  funding: number;  // $B
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
  targetCountry: string;
  framedCountry: string;
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

// ── Resource system (v0.2) ──

/** Contraband — bypasses sanctions but risky */
export interface SmuggleAction {
  type: 'smuggle';
  targetCountry: string;
  resource: ResourceType;
  amount: number;
  method: 'land_border' | 'sea_route' | 'intermediary_country' | 'diplomatic_pouch';
}

/** Resource theft — cyber siphon, piracy, illegal mining, pipeline tapping */
export interface ResourceTheftAction {
  type: 'resource_theft';
  targetCountry: string;
  resource: ResourceType;
  method: 'cyber_siphon' | 'piracy' | 'illegal_mining' | 'pipeline_tap';
}

/** Build strategic reserve for a resource */
export interface BuildStockpileAction {
  type: 'build_stockpile';
  resource: ResourceType;
  months: number; // 1-12
}

/** OPEC-style price manipulation */
export interface ManipulatePriceAction {
  type: 'manipulate_price';
  resource: ResourceType;
  direction: 'increase' | 'decrease';
  method: 'production_cut' | 'dump_stockpile' | 'cartel_coordination';
}

// ── Intelligence (v0.3) ──

/** Launch a spy operation against a target country */
export interface LaunchSpyOpAction {
  type: 'launch_spy_op';
  targetCountry: string;
  opType: SpyOpType;
}

/** Boost counterintelligence (makes it harder for others to spy on you) */
export interface BoostCounterIntelAction {
  type: 'boost_counter_intel';
  amount: number; // $B to invest
}

/** Launch disinformation campaign (fake data about yourself) */
export interface LaunchDisinfoAction {
  type: 'launch_disinfo';
  category: keyof RevealedCategories;
  multiplier: number; // e.g. 1.5 = appear 50% stronger, 0.7 = appear weaker
  duration: number;   // months
}

/** Set ongoing intelligence budget allocation */
export interface SetIntelBudgetAction {
  type: 'set_intel_budget';
  budget: number; // $B per tick
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
