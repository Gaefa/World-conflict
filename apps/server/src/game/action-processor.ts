import type {
  PlayerAction,
  ActionResult,
  GameState,
} from '@conflict-game/shared-types';
import {
  processSetTaxRate,
  processAllocateBudget,
  processResearchTechV2,
  processCancelResearch,
  processArmsDeal,
  processSanctionEvasion,
} from './actions/economy';
import {
  processSmuggle,
  processResourceTheft,
  processBuildStockpile,
  processManipulatePrice,
} from './actions/economy-resources';
import {
  processDeclareWar,
  processProposeAlliance,
  processProposeSanction,
  processProposeTrade,
  processProposePeace,
  processProposalResponse,
} from './actions/diplomacy';
import {
  processCreateArmy,
  processMoveArmy,
  processAirstrike,
  processInvasion,
  processNavalBlockade,
} from './actions/military';
import {
  processProxyWar,
  processInciteRebellion,
  processSabotage,
  processCyberAttack,
  processCoupAttempt,
  processPropaganda,
  processFalseFlag,
} from './actions/covert';
import {
  processLaunchSpyOp,
  processBoostCounterIntel,
  processLaunchDisinfo,
  processSetIntelBudget,
} from './actions/intelligence';
import { fail } from './actions/_helpers';

/**
 * Process a player action against the current game state.
 * Returns an ActionResult with effects + mutates the game state in place.
 */
export function processAction(
  state: GameState,
  playerCountryCode: string,
  action: PlayerAction,
): ActionResult {
  const country = state.countries[playerCountryCode];
  if (!country) {
    return fail(action, 'Country not found in game state');
  }

  switch (action.type) {
    case 'set_tax_rate':
      return processSetTaxRate(country, action.rate, action);

    case 'allocate_budget':
      return processAllocateBudget(country, action.category, action.amount, action);

    case 'research_tech':
      return processResearchTechV2(state, country, action);
    case 'cancel_research':
      return processCancelResearch(country, action);

    case 'declare_war':
      return processDeclareWar(state, playerCountryCode, action.targetCountry, action);

    case 'propose_alliance':
      return processProposeAlliance(state, playerCountryCode, action.targetCountry, action);

    case 'propose_sanction':
      return processProposeSanction(state, playerCountryCode, action.targetCountry, action);

    case 'propose_trade':
      return processProposeTrade(state, playerCountryCode, action.targetCountry, action);

    case 'propose_peace':
      return processProposePeace(state, playerCountryCode, action.targetCountry, action);

    case 'create_army':
      return processCreateArmy(state, country, playerCountryCode, action);

    case 'move_army':
      return processMoveArmy(state, action);

    case 'accept_proposal':
    case 'reject_proposal':
      return processProposalResponse(state, action);

    // ── Military operations ──
    case 'airstrike':
      return processAirstrike(state, country, playerCountryCode, action);
    case 'invasion':
      return processInvasion(state, country, playerCountryCode, action);
    case 'naval_blockade':
      return processNavalBlockade(state, country, playerCountryCode, action);

    // ── Covert / hybrid warfare ──
    case 'proxy_war':
      return processProxyWar(state, country, playerCountryCode, action);
    case 'incite_rebellion':
      return processInciteRebellion(state, country, playerCountryCode, action);
    case 'sabotage':
      return processSabotage(state, country, playerCountryCode, action);
    case 'cyber_attack':
      return processCyberAttack(state, country, playerCountryCode, action);
    case 'coup_attempt':
      return processCoupAttempt(state, country, playerCountryCode, action);

    // ── Information warfare ──
    case 'propaganda':
      return processPropaganda(state, country, playerCountryCode, action);
    case 'false_flag':
      return processFalseFlag(state, country, playerCountryCode, action);

    // ── Arms ──
    case 'arms_deal':
      return processArmsDeal(state, country, playerCountryCode, action);

    // ── Sanction evasion ──
    case 'sanction_evasion':
      return processSanctionEvasion(state, country, playerCountryCode, action);

    // ── Resource system (v0.2) ──
    case 'smuggle':
      return processSmuggle(state, country, playerCountryCode, action);
    case 'resource_theft':
      return processResourceTheft(state, country, playerCountryCode, action);
    case 'build_stockpile':
      return processBuildStockpile(state, country, playerCountryCode, action);
    case 'manipulate_price':
      return processManipulatePrice(state, country, playerCountryCode, action);
    case 'counter_trade':
      return fail(action, 'Counter trade not yet implemented');

    // Intelligence (v0.3)
    case 'launch_spy_op':
      return processLaunchSpyOp(state, country, playerCountryCode, action);
    case 'boost_counter_intel':
      return processBoostCounterIntel(country, action);
    case 'launch_disinfo':
      return processLaunchDisinfo(state, country, action);
    case 'set_intel_budget':
      return processSetIntelBudget(country, action);

    default:
      return fail(action, 'Unknown action type');
  }
}
