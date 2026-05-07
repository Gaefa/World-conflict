import type {
  PlayerAction,
  ActionResult,
  GameState,
  DiplomaticRelation,
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
  const allianceRel = makeDipRelation(state, 'alliance', fromCode, targetCode);
  allianceRel.status = 'proposed';
  state.relations.push(allianceRel);

  addEvent(state, 'diplomatic_incident',
    `${fromCode} proposes alliance to ${targetCode}`,
    `${fromCode} has sent a formal alliance proposal to ${targetCode}. Awaiting response.`,
    'medium', [fromCode, targetCode]);

  return {
    success: true, action,
    message: `Alliance proposed to ${targetCode} — awaiting response`,
    effects: [
      { description: 'Diplomatic influence -5', known: true, value: '-5' },
      { description: 'Awaiting acceptance', known: true },
      { description: 'Mutual defense pact if accepted', known: false },
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
  relation.status = 'proposed';
  relation.expiresAtTick = state.session.currentTick + duration;
  (relation as any).tradeFlows = tradeFlows;
  state.relations.push(relation);

  const flowDesc = tradeFlows.length > 0
    ? tradeFlows.map((f: any) => `${f.resource} x${f.amountPerTick}/mo`).join(', ')
    : 'general trade';

  addEvent(state, 'diplomatic_incident',
    `${fromCode} proposes trade to ${targetCode}`,
    `${fromCode} has sent a trade proposal to ${targetCode}. Awaiting response.`,
    'low', [fromCode, targetCode]);

  return {
    success: true, action,
    message: `Trade proposed to ${targetCode} — awaiting response`,
    effects: [
      { description: 'Diplomatic influence -2', known: true, value: '-2' },
      { description: `Proposed: ${flowDesc}`, known: true },
      { description: `Duration if accepted: ${duration} months`, known: true },
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

  // Create a peace proposal (not immediate — target must accept)
  const peaceRel = makeDipRelation(state, 'non_aggression', fromCode, targetCode);
  peaceRel.status = 'proposed';
  (peaceRel as DiplomaticRelation & { warRelationId: string }).warRelationId = warRelation.id;
  state.relations.push(peaceRel);

  addEvent(state, 'diplomatic_incident',
    `${fromCode} proposes peace to ${targetCode}`,
    `${fromCode} has sent a peace proposal to ${targetCode}. Awaiting acceptance.`,
    'medium', [fromCode, targetCode]);

  return {
    success: true, action,
    message: `Peace proposed to ${targetCode} — awaiting acceptance`,
    effects: [
      { description: 'Awaiting response', known: true },
      { description: 'Stability +5 on acceptance', known: true, value: '+5' },
      { description: 'Approval +5 on acceptance', known: true, value: '+5' },
    ],
  };
}

/**
 * Counter-trade: the target of a pending trade proposal modifies the terms.
 * This replaces the tradeFlows on the pending relation and leaves it in
 * 'pending' state so the original proposer (or AI logic) can accept/reject
 * the new terms on the next tick.
 */
export function processCounterTrade(
  state: GameState,
  playerCode: string,
  action: PlayerAction,
): ActionResult {
  const a = action as { relationId: string; offers?: any[]; requests?: any[] };
  const relation = state.relations.find(r => r.id === a.relationId && r.type === 'trade_agreement');
  if (!relation) return fail(action, 'Trade proposal not found');
  if (relation.status !== 'proposed') return fail(action, 'Trade proposal is no longer pending');

  // Only the target (toCountry) may counter. From the engine's perspective
  // we swap direction: the counter-proposer becomes the new fromCountry.
  const isTarget = relation.toCountry === playerCode;
  const isProposer = relation.fromCountry === playerCode;
  if (!isTarget && !isProposer) return fail(action, 'You are not party to this trade proposal');

  const tradeFlows: any[] = [];
  if (a.offers) {
    for (const offer of a.offers) {
      tradeFlows.push({
        resource: offer.resource,
        amountPerTick: offer.amount,
        // offers from counter-proposer are always from_to relative to them
        direction: (playerCode === relation.fromCountry ? 'from_to' : 'to_from') as 'from_to' | 'to_from',
        priceModifier: offer.priceModifier ?? 1.0,
      });
    }
  }
  if (a.requests) {
    for (const req of a.requests) {
      tradeFlows.push({
        resource: req.resource,
        amountPerTick: req.amount,
        direction: (playerCode === relation.fromCountry ? 'to_from' : 'from_to') as 'from_to' | 'to_from',
        priceModifier: req.priceModifier ?? 1.0,
      });
    }
  }

  // Update flows; keep 'proposed' so the other party (AI or human) can respond.
  (relation as any).tradeFlows = tradeFlows;

  const desc = tradeFlows.map((f: any) => `${f.resource} ×${f.amountPerTick}/mo`).join(', ');
  return {
    success: true, action,
    message: `Counter-trade sent to ${playerCode === relation.fromCountry ? relation.toCountry : relation.fromCountry}: ${desc}`,
    effects: [
      { description: `New terms: ${desc}`, known: true },
      { description: 'Awaiting response', known: true },
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
    // Peace proposal: end the war, give bonuses
    type PeaceRel = DiplomaticRelation & { warRelationId?: string };
    const warRelationId = (relation as PeaceRel).warRelationId;
    const isPeace = relation.type === 'non_aggression' && warRelationId;
    if (isPeace) {
      const warRel = state.relations.find(r => r.id === warRelationId);
      if (warRel) warRel.status = 'expired';
      relation.status = 'expired'; // the proposal itself expires
      for (const code of [relation.fromCountry, relation.toCountry]) {
        const c = state.countries[code];
        if (c) {
          c.stability = clamp(c.stability + 5, 0, 100);
          c.approval = clamp(c.approval + 5, 0, 100);
        }
      }
      addEvent(state, 'diplomatic_incident',
        `Peace treaty: ${relation.fromCountry} & ${relation.toCountry}`,
        `A peace treaty has been signed. The war is over.`,
        'low', [relation.fromCountry, relation.toCountry]);
      return {
        success: true, action,
        message: `Peace accepted — war with ${relation.fromCountry} ended`,
        effects: [
          { description: 'War ended', known: true },
          { description: 'Stability +5', known: true, value: '+5' },
          { description: 'Approval +5', known: true, value: '+5' },
        ],
      };
    }

    relation.status = 'active';
    addEvent(state, 'diplomatic_incident',
      `${relation.toCountry} accepts ${relation.type} from ${relation.fromCountry}`,
      `${relation.toCountry} has accepted the ${relation.type} proposal.`,
      'low', [relation.fromCountry, relation.toCountry]);
    return {
      success: true, action,
      message: `${relation.type} with ${relation.fromCountry} accepted`,
      effects: [{ description: `${relation.type} now active`, known: true }],
    };
  } else {
    relation.status = 'rejected';
    return {
      success: true, action,
      message: `${relation.type} from ${relation.fromCountry} rejected`,
      effects: [{ description: `${relation.type} declined`, known: true }],
    };
  }
}
