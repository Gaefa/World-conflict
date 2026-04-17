import type {
  PlayerAction,
  ActionResult,
  GameState,
} from '@conflict-game/shared-types';
import { addEvent, clamp, fail, makeDipRelation } from './_helpers';

export function processDeclareWar(
  state: GameState,
  fromCode: string,
  targetCode: string,
  action: PlayerAction,
): ActionResult {
  if (fromCode === targetCode) return fail(action, 'Cannot declare war on yourself');
  if (!state.countries[targetCode]) return fail(action, 'Target country not in game');

  const existing = state.relations.find(
    r => r.type === 'war' && r.status === 'active' &&
    ((r.fromCountry === fromCode && r.toCountry === targetCode) ||
     (r.fromCountry === targetCode && r.toCountry === fromCode))
  );
  if (existing) return fail(action, 'Already at war with this country');

  const from = state.countries[fromCode];
  state.relations.push(makeDipRelation(state, 'war', fromCode, targetCode));

  // War costs — diplomatic and stability hit
  from.stability = clamp(from.stability - 10, 0, 100);
  from.diplomaticInfluence = clamp(from.diplomaticInfluence - 10, 0, 100);

  // War PERKS — mobilization economy, rallying effect, military boost
  from.military.army = Math.floor(from.military.army * 1.15); // 15% mobilization
  from.military.defenseBudget *= 1.2; // war economy
  from.economy.gdpGrowth += 0.5; // war stimulus (short-term)
  // Rally-around-the-flag effect (short-term approval boost)
  from.approval = clamp(from.approval + 5, 0, 100);

  addEvent(state, 'diplomatic_incident',
    `${fromCode} declares war on ${targetCode}`,
    `${fromCode} has declared war on ${targetCode}. Full mobilization ordered. War economy activated.`,
    'critical', [fromCode, targetCode]);

  return {
    success: true, action,
    message: `War declared on ${targetCode} — mobilization activated`,
    effects: [
      { description: 'Stability -10', known: true, value: '-10' },
      { description: 'Diplomatic influence -10', known: true, value: '-10' },
      { description: 'PERK: Mobilization — Army +15%', known: true },
      { description: 'PERK: War economy — Defense budget +20%', known: true },
      { description: 'PERK: GDP growth +0.5% (war stimulus)', known: true },
      { description: 'PERK: Rally-around-flag — Approval +5', known: true },
      { description: 'Military ops against target cost less', known: true },
      { description: 'Allied nations may respond', known: false },
      { description: 'Long-term economic damage if protracted', known: false },
    ],
  };
}

export function processProposeAlliance(
  state: GameState,
  fromCode: string,
  targetCode: string,
  action: PlayerAction,
): ActionResult {
  if (fromCode === targetCode) return fail(action, 'Cannot ally with yourself');
  if (!state.countries[targetCode]) return fail(action, 'Target country not in game');

  const from = state.countries[fromCode];
  if (from.diplomaticInfluence < 5) return fail(action, 'Insufficient diplomatic influence (need 5)');

  const existing = state.relations.find(
    r => r.type === 'alliance' && r.status === 'active' &&
    ((r.fromCountry === fromCode && r.toCountry === targetCode) ||
     (r.fromCountry === targetCode && r.toCountry === fromCode))
  );
  if (existing) return fail(action, 'Already allied with this country');

  from.diplomaticInfluence -= 5;
  state.relations.push(makeDipRelation(state, 'alliance', fromCode, targetCode));

  addEvent(state, 'diplomatic_incident',
    `${fromCode} and ${targetCode} form alliance`,
    `A new alliance has been established.`,
    'medium', [fromCode, targetCode]);

  return {
    success: true, action,
    message: `Alliance formed with ${targetCode}`,
    effects: [
      { description: 'Diplomatic influence -5', known: true, value: '-5' },
      { description: 'Mutual defense pact active', known: true },
      { description: 'Trade benefits may follow', known: false },
    ],
  };
}

export function processProposeSanction(
  state: GameState,
  fromCode: string,
  targetCode: string,
  action: PlayerAction,
): ActionResult {
  if (fromCode === targetCode) return fail(action, 'Cannot sanction yourself');
  if (!state.countries[targetCode]) return fail(action, 'Target country not in game');

  const from = state.countries[fromCode];
  if (from.diplomaticInfluence < 3) return fail(action, 'Insufficient diplomatic influence (need 3)');

  from.diplomaticInfluence -= 3;
  state.relations.push(makeDipRelation(state, 'sanction', fromCode, targetCode));

  state.countries[targetCode].economy.gdpGrowth -= 0.5;

  addEvent(state, 'diplomatic_incident',
    `${fromCode} imposes sanctions on ${targetCode}`,
    `Economic sanctions have been imposed on ${targetCode}.`,
    'high', [fromCode, targetCode]);

  return {
    success: true, action,
    message: `Sanctions imposed on ${targetCode}`,
    effects: [
      { description: 'Diplomatic influence -3', known: true, value: '-3' },
      { description: 'Target GDP growth -0.5%', known: true },
      { description: 'Target stability may decrease', known: false },
      { description: 'Retaliation possible', known: false },
    ],
  };
}

export function processProposeTrade(
  state: GameState,
  fromCode: string,
  targetCode: string,
  action: PlayerAction,
): ActionResult {
  if (!state.countries[targetCode]) return fail(action, 'Target country not in game');

  const from = state.countries[fromCode];
  if (from.diplomaticInfluence < 2) return fail(action, 'Insufficient diplomatic influence (need 2)');

  // Check no active sanctions/war between parties
  const blocked = state.relations.some(r =>
    r.status === 'active' &&
    (r.type === 'sanction' || r.type === 'war') &&
    ((r.fromCountry === fromCode && r.toCountry === targetCode) ||
     (r.fromCountry === targetCode && r.toCountry === fromCode))
  );
  if (blocked) return fail(action, 'Cannot trade — active sanctions or war');

  from.diplomaticInfluence -= 2;

  // Build trade flows from offers/requests (Civ-style)
  const tradeAction = action as { offers?: any[]; requests?: any[]; duration?: number };
  const tradeFlows: any[] = [];

  if (tradeAction.offers) {
    for (const offer of tradeAction.offers) {
      tradeFlows.push({
        resource: offer.resource,
        amountPerTick: offer.amount,
        direction: 'from_to' as const,
        priceModifier: offer.priceModifier ?? 1.0,
      });
    }
  }
  if (tradeAction.requests) {
    for (const req of tradeAction.requests) {
      tradeFlows.push({
        resource: req.resource,
        amountPerTick: req.amount,
        direction: 'to_from' as const,
        priceModifier: req.priceModifier ?? 1.0,
      });
    }
  }

  const duration = tradeAction.duration ?? 12;
  const relation = makeDipRelation(state, 'trade_agreement', fromCode, targetCode);
  relation.expiresAtTick = state.session.currentTick + duration;
  (relation as any).tradeFlows = tradeFlows;
  state.relations.push(relation);

  const flowDesc = tradeFlows.length > 0
    ? tradeFlows.map((f: any) => `${f.resource} x${f.amountPerTick}/mo`).join(', ')
    : 'general trade';

  return {
    success: true, action,
    message: `Trade agreement with ${targetCode}: ${flowDesc}`,
    effects: [
      { description: 'Diplomatic influence -2', known: true, value: '-2' },
      { description: `Trade flows: ${flowDesc}`, known: true },
      { description: `Duration: ${duration} months`, known: true },
      { description: 'Resources will flow via resource tick', known: false },
    ],
  };
}

export function processProposePeace(
  state: GameState,
  fromCode: string,
  targetCode: string,
  action: PlayerAction,
): ActionResult {
  const warRelation = state.relations.find(
    r => r.type === 'war' && r.status === 'active' &&
    ((r.fromCountry === fromCode && r.toCountry === targetCode) ||
     (r.fromCountry === targetCode && r.toCountry === fromCode))
  );
  if (!warRelation) return fail(action, `Not at war with ${targetCode}`);

  warRelation.status = 'expired'; // closest valid status for "ended"

  const from = state.countries[fromCode];
  from.stability = clamp(from.stability + 5, 0, 100);
  from.approval = clamp(from.approval + 5, 0, 100);

  addEvent(state, 'diplomatic_incident',
    `Peace between ${fromCode} and ${targetCode}`,
    `A peace treaty has been signed.`,
    'low', [fromCode, targetCode]);

  return {
    success: true, action,
    message: `Peace treaty signed with ${targetCode}`,
    effects: [
      { description: 'War ended', known: true },
      { description: 'Stability +5', known: true, value: '+5' },
      { description: 'Approval +5', known: true, value: '+5' },
      { description: 'Economic recovery may follow', known: false },
    ],
  };
}

export function processProposalResponse(
  state: GameState,
  action: PlayerAction & { type: 'accept_proposal' | 'reject_proposal' },
): ActionResult {
  const relation = state.relations.find(r => r.id === action.relationId);
  if (!relation) return fail(action, 'Proposal not found');

  if (action.type === 'accept_proposal') {
    relation.status = 'active';
    return {
      success: true, action,
      message: 'Proposal accepted',
      effects: [{ description: `${relation.type} with ${relation.fromCountry} accepted`, known: true }],
    };
  } else {
    relation.status = 'rejected';
    return {
      success: true, action,
      message: 'Proposal rejected',
      effects: [{ description: `${relation.type} with ${relation.fromCountry} rejected`, known: true }],
    };
  }
}
