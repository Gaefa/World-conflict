import type {
  PlayerAction,
  ActionResult,
  ActionEffect,
  GameState,
  CountryState,
  DiplomaticRelation,
  SpyOpType,
} from '@conflict-game/shared-types';
import { SPY_OP_CONFIG, TECH_TREE, defaultTechBonuses } from '@conflict-game/shared-types';
import { recruitmentCost, canResearchTech, computeTechBonuses } from '@conflict-game/game-logic';

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

// ── Individual action processors ──

function processSetTaxRate(country: CountryState, rate: number, action: PlayerAction): ActionResult {
  if (rate < 0 || rate > 1) return fail(action, 'Tax rate must be between 0 and 1');

  const oldRate = country.economy.taxRate;
  country.economy.taxRate = rate;

  const approvalChange = (rate - oldRate) * -30;
  country.approval = clamp(country.approval + approvalChange, 0, 100);

  const effects: ActionEffect[] = [
    { description: `Tax rate: ${(oldRate * 100).toFixed(0)}% → ${(rate * 100).toFixed(0)}%`, known: true, value: `${(rate * 100).toFixed(0)}%` },
    { description: `Budget revenue ${rate > oldRate ? 'increased' : 'decreased'}`, known: true },
    { description: `Approval ${approvalChange > 0 ? '+' : ''}${approvalChange.toFixed(0)}`, known: true, value: `${approvalChange.toFixed(0)}` },
  ];

  if (rate > 0.4) {
    effects.push({ description: 'High taxes may slow GDP growth', known: false });
    country.economy.gdpGrowth -= 0.3;
  }

  return { success: true, action, message: 'Tax rate adjusted', effects };
}

function processAllocateBudget(
  country: CountryState,
  category: 'military' | 'economy' | 'technology' | 'social',
  amount: number,
  action: PlayerAction,
): ActionResult {
  if (amount > country.economy.budget) {
    return fail(action, `Insufficient budget. Available: $${country.economy.budget.toFixed(1)}B`);
  }
  if (amount <= 0) return fail(action, 'Amount must be positive');

  country.economy.budget -= amount;

  const effects: ActionEffect[] = [
    { description: `Budget: -$${amount.toFixed(1)}B`, known: true, value: `-$${amount.toFixed(1)}B` },
  ];

  switch (category) {
    case 'military':
      country.military.defenseBudget += amount;
      country.military.army += Math.floor(amount * 5000);
      effects.push({ description: `Defense budget +$${amount.toFixed(1)}B`, known: true });
      effects.push({ description: `Army +${Math.floor(amount * 5000)} personnel`, known: true });
      effects.push({ description: 'Neighboring countries may react', known: false });
      break;
    case 'economy':
      country.economy.gdpGrowth += amount * 0.1;
      effects.push({ description: `GDP growth +${(amount * 0.1).toFixed(1)}%`, known: true });
      effects.push({ description: 'Infrastructure improvements incoming', known: false });
      break;
    case 'technology':
      country.techLevel = Math.min(10, country.techLevel + amount * 0.05);
      effects.push({ description: `Tech level +${(amount * 0.05).toFixed(2)}`, known: true });
      effects.push({ description: 'New capabilities may unlock', known: false });
      break;
    case 'social':
      country.approval = clamp(country.approval + amount * 0.5, 0, 100);
      country.stability = clamp(country.stability + amount * 0.3, 0, 100);
      effects.push({ description: `Approval +${(amount * 0.5).toFixed(1)}`, known: true });
      effects.push({ description: `Stability +${(amount * 0.3).toFixed(1)}`, known: true });
      break;
  }

  return { success: true, action, message: `$${amount.toFixed(1)}B allocated to ${category}`, effects };
}

function processResearchTechV2(
  state: GameState,
  country: CountryState,
  action: PlayerAction & { type: 'research_tech' },
): ActionResult {
  const techId = action.techId;
  if (!techId) return fail(action, 'No techId specified');

  const techDef = TECH_TREE[techId];
  if (!techDef) return fail(action, `Unknown technology: ${techId}`);

  // Initialize tech state if needed
  if (!country.tech) {
    country.tech = { researchedTechs: [], activeResearch: null, bonuses: defaultTechBonuses() };
  }

  // Check not already researching
  if (country.tech.activeResearch) {
    return fail(action, `Already researching: ${TECH_TREE[country.tech.activeResearch.techId]?.name ?? country.tech.activeResearch.techId}`);
  }

  // Check prerequisites
  if (!canResearchTech(country.tech, techId)) {
    const missing = techDef.prerequisites.filter(p => !country.tech!.researchedTechs.includes(p));
    const missingNames = missing.map(p => TECH_TREE[p]?.name ?? p).join(', ');
    return fail(action, `Prerequisites not met: ${missingNames}`);
  }

  // Check budget
  if (country.economy.budget < techDef.cost) {
    return fail(action, `Insufficient budget: need $${techDef.cost}B, have $${country.economy.budget.toFixed(1)}B`);
  }

  // Deduct cost, start research
  country.economy.budget -= techDef.cost;
  country.tech.activeResearch = {
    techId,
    startedTick: state.session.currentTick,
    ticksRemaining: techDef.researchTicks,
    totalTicks: techDef.researchTicks,
    investedCost: techDef.cost,
  };

  const effects: ActionEffect[] = [
    { description: `Researching: ${techDef.name}`, known: true },
    { description: `Cost: $${techDef.cost}B`, known: true, value: `-$${techDef.cost}B` },
    { description: `Duration: ${techDef.researchTicks} months`, known: true },
    ...techDef.effects.map(e => ({ description: e.description, known: false })),
  ];

  return { success: true, action, message: `Research started: ${techDef.name}`, effects };
}

function processCancelResearch(
  country: CountryState,
  action: PlayerAction,
): ActionResult {
  if (!country.tech?.activeResearch) {
    return fail(action, 'No active research to cancel');
  }

  const { techId, investedCost } = country.tech.activeResearch;
  const techDef = TECH_TREE[techId];
  const refund = Math.floor(investedCost * 0.5);

  country.economy.budget += refund;
  country.tech.activeResearch = null;

  return {
    success: true, action,
    message: `Research cancelled: ${techDef?.name ?? techId}`,
    effects: [
      { description: `Refunded: $${refund}B (50%)`, known: true, value: `+$${refund}B` },
    ],
  };
}

function makeDipRelation(
  state: GameState,
  type: DiplomaticRelation['type'],
  fromCode: string,
  targetCode: string,
): DiplomaticRelation {
  return {
    id: `rel-${type}-${fromCode}-${targetCode}-${Date.now()}`,
    sessionId: state.session.id,
    fromCountry: fromCode,
    toCountry: targetCode,
    type,
    status: 'active',
    createdAtTick: state.session.currentTick,
    expiresAtTick: null,
  };
}

function addEvent(
  state: GameState,
  type: string,
  title: string,
  description: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  involved: string[],
) {
  state.events.push({
    id: `evt-${type}-${involved.join('-')}-${state.session.currentTick}`,
    sessionId: state.session.id,
    type: type as any,
    title,
    description,
    severity,
    involvedCountries: involved,
    tick: state.session.currentTick,
    data: {},
    createdAt: new Date().toISOString(),
  });
}

function processDeclareWar(
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

function processProposeAlliance(
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

function processProposeSanction(
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

function processProposeTrade(
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

function processProposePeace(
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

function processCreateArmy(
  state: GameState,
  country: CountryState,
  countryCode: string,
  action: PlayerAction & { type: 'create_army' },
): ActionResult {
  const cost = recruitmentCost(action.armyType, action.size);
  if (country.economy.budget < cost) {
    return fail(action, `Insufficient budget. Need $${cost.toFixed(1)}B, have $${country.economy.budget.toFixed(1)}B`);
  }

  country.economy.budget -= cost;
  country.stability = clamp(country.stability - 1, 0, 100);

  state.armies.push({
    id: `army-${countryCode}-${Date.now()}`,
    ownerCountry: countryCode,
    sessionId: state.session.id,
    name: action.name,
    type: action.armyType as any,
    size: action.size,
    latitude: action.latitude,
    longitude: action.longitude,
    targetLatitude: null,
    targetLongitude: null,
    morale: 80,
    experience: 0,
    status: 'idle',
    createdAtTick: state.session.currentTick,
  });

  return {
    success: true, action,
    message: `${action.name} recruited`,
    effects: [
      { description: `Budget: -$${cost.toFixed(1)}B`, known: true, value: `-$${cost.toFixed(1)}B` },
      { description: `${action.size} ${action.armyType} recruited`, known: true },
      { description: 'Stability -1', known: true, value: '-1' },
      { description: 'Neighbors may notice military buildup', known: false },
    ],
  };
}

function processMoveArmy(
  state: GameState,
  action: PlayerAction & { type: 'move_army' },
): ActionResult {
  const army = state.armies.find(a => a.id === action.armyId);
  if (!army) return fail(action, 'Army not found');

  army.targetLatitude = action.targetLat;
  army.targetLongitude = action.targetLng;
  army.status = 'moving';

  return {
    success: true, action,
    message: `${army.name} moving to target`,
    effects: [
      { description: 'Army repositioning', known: true },
      { description: 'Movement may be detected', known: false },
    ],
  };
}

function processProposalResponse(
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

// ══════════════════════════════════════════════════════════
// MILITARY OPERATIONS
// ══════════════════════════════════════════════════════════

function processAirstrike(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'airstrike' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  // War not required (2026 reality) but being at war reduces diplomatic cost
  const atWar = isAtWar(state, fromCode, action.targetCountry);

  if (from.military.airForce < 10) return fail(action, 'Insufficient air force');

  const costs: Record<string, { budget: number; planes: number }> = {
    surgical: { budget: 2, planes: 5 },
    conventional: { budget: 8, planes: 20 },
    carpet: { budget: 20, planes: 50 },
  };
  const c = costs[action.intensity];
  if (from.economy.budget < c.budget) return fail(action, `Need $${c.budget}B budget`);
  if (from.military.airForce < c.planes) return fail(action, `Need ${c.planes} aircraft`);

  from.economy.budget -= c.budget;
  from.military.airForce -= Math.floor(c.planes * 0.1); // 10% losses

  const dmgMultiplier = { surgical: 1, conventional: 3, carpet: 8 }[action.intensity];
  target.economy.gdp -= target.economy.gdp * (0.005 * dmgMultiplier);
  target.stability = clamp(target.stability - 3 * dmgMultiplier, 0, 100);
  target.military.army -= Math.floor(target.military.army * 0.02 * dmgMultiplier);

  if (!atWar) {
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 15, 0, 100);
    from.approval = clamp(from.approval - 5, 0, 100);
  }

  const civilianCasualties = action.intensity === 'carpet';
  if (civilianCasualties) {
    from.approval = clamp(from.approval - 10, 0, 100);
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 10, 0, 100);
  }

  addEvent(state, 'military_incident',
    `Airstrike on ${action.targetCountry}`,
    `${fromCode} launched ${action.intensity} airstrike on ${action.targetCountry}.${civilianCasualties ? ' Civilian casualties reported.' : ''}`,
    civilianCasualties ? 'critical' : 'high', [fromCode, action.targetCountry]);

  return {
    success: true, action,
    message: `${action.intensity} airstrike on ${action.targetCountry}`,
    effects: [
      { description: `Budget -$${c.budget}B`, known: true, value: `-$${c.budget}B` },
      { description: `Aircraft losses: ~${Math.floor(c.planes * 0.1)}`, known: true },
      { description: `Target GDP damaged`, known: true },
      { description: `Target stability -${3 * dmgMultiplier}`, known: true },
      { description: `Target military casualties`, known: true },
      ...(civilianCasualties ? [{ description: 'Civilian casualties — global condemnation', known: true }] : []),
      ...(atWar ? [] : [{ description: 'Diplomatic influence -15 (covert operation)', known: true, value: '-15' }]),
      { description: 'Retaliation strike possible', known: false },
      { description: 'International response pending', known: false },
    ],
  };
}

function processInvasion(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'invasion' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');
  if (fromCode === action.targetCountry) return fail(action, 'Cannot invade yourself');

  // War not required but invading without declaration = massive diplomatic hit
  const atWar = isAtWar(state, fromCode, action.targetCountry);
  if (!atWar) {
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 25, 0, 100);
    from.approval = clamp(from.approval - 15, 0, 100);
  }

  const forces = Math.max(0.1, Math.min(1.0, action.committedForces));
  const committedTroops = Math.floor(from.military.army * forces);
  if (committedTroops < 1000) return fail(action, 'Need at least 1,000 troops');

  const cost = committedTroops * 0.00005; // ~$50K per soldier
  if (from.economy.budget < cost) return fail(action, `Need $${cost.toFixed(1)}B for operation`);

  from.economy.budget -= cost;

  // Battle resolution
  const attackPower = committedTroops * (1 + from.military.techLevel * 0.1);
  const defensePower = target.military.army * 1.3 * (1 + target.military.techLevel * 0.1); // 30% defense bonus

  const ratio = attackPower / (attackPower + defensePower);
  const success = Math.random() < ratio;

  const attackerLosses = Math.floor(committedTroops * (success ? 0.15 : 0.35));
  const defenderLosses = Math.floor(target.military.army * (success ? 0.4 : 0.15));

  from.military.army -= attackerLosses;
  target.military.army -= defenderLosses;
  target.stability = clamp(target.stability - (success ? 25 : 5), 0, 100);
  from.stability = clamp(from.stability - (success ? 5 : 15), 0, 100);

  if (success) {
    //占领 — target loses GDP, attacker gains resources
    target.economy.gdp *= 0.85;
    from.economy.gdp += target.economy.gdp * 0.05;
    target.approval = clamp(target.approval - 20, 0, 100);
  } else {
    from.approval = clamp(from.approval - 15, 0, 100);
  }

  addEvent(state, 'military_incident',
    `${fromCode} invades ${action.targetCountry}`,
    `${fromCode} committed ${committedTroops.toLocaleString()} troops. ${success ? 'Invasion successful.' : 'Invasion repelled.'}`,
    'critical', [fromCode, action.targetCountry]);

  return {
    success: true, action,
    message: success ? `Invasion of ${action.targetCountry} successful` : `Invasion of ${action.targetCountry} repelled`,
    effects: [
      { description: `Budget -$${cost.toFixed(1)}B`, known: true },
      { description: `Committed ${committedTroops.toLocaleString()} troops`, known: true },
      { description: `Your losses: ${attackerLosses.toLocaleString()} troops`, known: true },
      { description: `Enemy losses: ${defenderLosses.toLocaleString()} troops`, known: true },
      { description: success ? 'Territory captured — GDP extraction' : 'Forces retreating', known: true },
      ...(!atWar ? [{ description: 'No war declaration — Influence -25, Approval -15', known: true }] : []),
      { description: success ? 'Occupation resistance expected' : 'Morale damaged', known: false },
      { description: 'Allied nations may intervene', known: false },
    ],
  };
}

function processNavalBlockade(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'naval_blockade' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  if (from.military.navy < 20) return fail(action, 'Need at least 20 naval vessels');

  const cost = 5;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);

  from.economy.budget -= cost;
  from.military.navy -= 2; // committed vessels

  // Create a naval_blockade relation — resource tick will disrupt all sea trade flows
  const relation = makeDipRelation(state, 'naval_blockade' as any, fromCode, action.targetCountry);
  relation.expiresAtTick = state.session.currentTick + 6; // lasts 6 months
  state.relations.push(relation);

  // Immediate stability hit
  target.stability = clamp(target.stability - 3, 0, 100);

  if (!isAtWar(state, fromCode, action.targetCountry)) {
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 10, 0, 100);
  }

  addEvent(state, 'military_incident',
    `Naval blockade of ${action.targetCountry}`,
    `${fromCode} has established a naval blockade of ${action.targetCountry}. All trade routes disrupted.`,
    'high', [fromCode, action.targetCountry]);

  return {
    success: true, action,
    message: `Naval blockade of ${action.targetCountry} — trade routes disrupted`,
    effects: [
      { description: `Budget -$${cost}B`, known: true },
      { description: 'All trade with target disrupted', known: true },
      { description: 'Target stability -3', known: true },
      { description: 'Blockade lasts 6 months', known: true },
      { description: 'Resource prices may spike globally', known: false },
      { description: 'Humanitarian crisis risk', known: false },
    ],
  };
}

// ══════════════════════════════════════════════════════════
// COVERT / HYBRID WARFARE
// ══════════════════════════════════════════════════════════

function processProxyWar(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'proxy_war' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const funding = Math.max(1, Math.min(50, action.funding));
  if (from.economy.budget < funding) return fail(action, `Need $${funding}B budget`);
  if (from.diplomaticInfluence < 5) return fail(action, 'Need 5+ diplomatic influence');

  from.economy.budget -= funding;
  from.diplomaticInfluence -= 5;

  // Rebel effectiveness scales with funding and target instability
  const effectiveness = (funding / 10) * (1 + (100 - target.stability) / 100);

  target.stability = clamp(target.stability - effectiveness * 3, 0, 100);
  target.approval = clamp(target.approval - effectiveness * 2, 0, 100);
  target.military.army -= Math.floor(effectiveness * 500);
  target.economy.gdp -= target.economy.gdp * (effectiveness * 0.005);

  // Chance of exposure
  const exposed = Math.random() < 0.3;
  if (exposed) {
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 10, 0, 100);
    addEvent(state, 'political_scandal',
      `${fromCode} exposed funding rebels in ${action.targetCountry}`,
      `Intelligence leak reveals ${fromCode} is funding insurgents.`,
      'critical', [fromCode, action.targetCountry]);
  }

  addEvent(state, 'civil_unrest',
    `Armed insurgency in ${action.targetCountry}`,
    `Rebel forces have intensified operations in ${action.targetCountry}.`,
    'high', [action.targetCountry]);

  return {
    success: true, action,
    message: `Proxy war funded in ${action.targetCountry}`,
    effects: [
      { description: `Budget -$${funding}B`, known: true },
      { description: 'Influence -5', known: true },
      { description: `Target stability -${(effectiveness * 3).toFixed(0)}`, known: false },
      { description: 'Rebel forces armed and active', known: false },
      ...(exposed
        ? [{ description: 'EXPOSED — your involvement is public', known: true }]
        : [{ description: 'Operation remains covert... for now', known: false }]),
      { description: 'Conflict may escalate', known: false },
    ],
  };
}

function processInciteRebellion(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'incite_rebellion' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const cost = 8;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);
  if (from.diplomaticInfluence < 3) return fail(action, 'Need 3+ diplomatic influence');

  from.economy.budget -= cost;
  from.diplomaticInfluence -= 3;

  // Success depends on target stability and approval
  const baseChance = (100 - target.stability) / 100 * 0.5 + (100 - target.approval) / 100 * 0.3;
  const success = Math.random() < baseChance + 0.2;

  if (success) {
    target.stability = clamp(target.stability - 20, 0, 100);
    target.approval = clamp(target.approval - 15, 0, 100);
    target.economy.gdp -= target.economy.gdp * 0.03;

    addEvent(state, 'civil_unrest',
      `Mass protests in ${action.targetCountry}`,
      `Large-scale civil unrest erupted. Government buildings under siege.`,
      'critical', [action.targetCountry]);
  } else {
    // Failed — counter-intelligence caught you
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 8, 0, 100);
    addEvent(state, 'diplomatic_incident',
      `${action.targetCountry} accuses ${fromCode} of subversion`,
      `Counter-intelligence exposed foreign-backed rebellion plot.`,
      'high', [fromCode, action.targetCountry]);
  }

  return {
    success: true, action,
    message: success ? `Rebellion incited in ${action.targetCountry}` : `Rebellion attempt in ${action.targetCountry} failed — exposed`,
    effects: [
      { description: `Budget -$${cost}B`, known: true },
      { description: 'Influence -3', known: true },
      ...(success
        ? [
            { description: 'Target stability -20', known: false },
            { description: 'Target approval -15', known: false },
            { description: 'Economic disruption', known: false },
            { description: 'Regime change possible', known: false },
          ]
        : [
            { description: 'Operation compromised', known: true },
            { description: 'Influence -8 (exposed)', known: true, value: '-8' },
            { description: 'Relations severely damaged', known: true },
          ]),
    ],
  };
}

function processSabotage(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'sabotage' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const cost = 5;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);

  from.economy.budget -= cost;

  const techAdvantage = Math.max(0, from.techLevel - target.techLevel);
  const successChance = 0.4 + techAdvantage * 0.1;
  const success = Math.random() < successChance;

  const effects: ActionEffect[] = [
    { description: `Budget -$${cost}B`, known: true },
  ];

  if (success) {
    switch (action.target) {
      case 'infrastructure':
        target.economy.gdp -= target.economy.gdp * 0.02;
        target.economy.gdpGrowth -= 0.5;
        effects.push({ description: 'Infrastructure damaged — GDP -2%', known: false });
        effects.push({ description: 'GDP growth -0.5%', known: false });
        break;
      case 'military':
        target.military.army -= Math.floor(target.military.army * 0.05);
        target.military.defenseBudget -= 2;
        effects.push({ description: 'Military facilities sabotaged', known: false });
        effects.push({ description: 'Arms stockpiles destroyed', known: false });
        break;
      case 'energy':
        target.economy.gdp -= target.economy.gdp * 0.03;
        target.stability = clamp(target.stability - 8, 0, 100);
        effects.push({ description: 'Energy grid disrupted', known: false });
        effects.push({ description: 'Blackouts causing unrest', known: false });
        break;
      case 'communications':
        target.stability = clamp(target.stability - 5, 0, 100);
        target.approval = clamp(target.approval - 5, 0, 100);
        effects.push({ description: 'Communications networks down', known: false });
        effects.push({ description: 'Government coordination disrupted', known: false });
        break;
    }

    addEvent(state, 'political_scandal',
      `Sabotage attack on ${action.targetCountry} ${action.target}`,
      `${action.target} systems severely damaged in suspected sabotage.`,
      'high', [action.targetCountry]);
  } else {
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 5, 0, 100);
    effects.push({ description: 'Operation failed — agents captured', known: true });
    effects.push({ description: 'Influence -5', known: true, value: '-5' });

    addEvent(state, 'diplomatic_incident',
      `Sabotage agents from ${fromCode} captured in ${action.targetCountry}`,
      `Foreign operatives caught attempting to sabotage ${action.target}.`,
      'high', [fromCode, action.targetCountry]);
  }

  return { success: true, action, message: success ? `Sabotage of ${action.target} in ${action.targetCountry} successful` : `Sabotage failed — agents captured`, effects };
}

function processCyberAttack(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'cyber_attack' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const cost = 3;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);
  if (from.techLevel < 3) return fail(action, 'Need tech level 3+ for cyber operations');

  from.economy.budget -= cost;

  const cyberPower = from.techLevel * (1 + Math.random() * 0.5);
  const cyberDefense = target.techLevel * (1 + Math.random() * 0.3);
  const success = cyberPower > cyberDefense;

  const effects: ActionEffect[] = [
    { description: `Budget -$${cost}B`, known: true },
  ];

  if (success) {
    switch (action.target) {
      case 'government':
        target.stability = clamp(target.stability - 10, 0, 100);
        target.approval = clamp(target.approval - 8, 0, 100);
        effects.push({ description: 'Government systems compromised', known: false });
        effects.push({ description: 'Classified data extracted', known: false });
        break;
      case 'financial':
        target.economy.budget -= 5;
        target.economy.gdp -= target.economy.gdp * 0.01;
        effects.push({ description: 'Banking systems disrupted — $5B drained', known: false });
        effects.push({ description: 'Stock markets crashed', known: false });
        break;
      case 'military':
        target.military.techLevel = Math.max(1, target.military.techLevel - 0.5);
        effects.push({ description: 'Military C2 systems breached', known: false });
        effects.push({ description: 'Weapon systems codes compromised', known: false });
        break;
      case 'infrastructure':
        target.stability = clamp(target.stability - 7, 0, 100);
        target.economy.gdpGrowth -= 0.3;
        effects.push({ description: 'Critical infrastructure disrupted', known: false });
        effects.push({ description: 'Power grid partially offline', known: false });
        break;
    }

    // Low detection chance for cyber
    const detected = Math.random() < 0.2;
    if (detected) {
      effects.push({ description: 'Attack traced back — cover blown', known: true });
      from.diplomaticInfluence = clamp(from.diplomaticInfluence - 5, 0, 100);
    } else {
      effects.push({ description: 'Attribution unclear — plausible deniability', known: false });
    }
  } else {
    effects.push({ description: 'Cyber defenses held — attack repelled', known: true });
    effects.push({ description: 'Target alerted to threat', known: false });
  }

  return { success: true, action, message: success ? `Cyber attack on ${action.targetCountry} ${action.target} successful` : `Cyber attack blocked by ${action.targetCountry} defenses`, effects };
}

function processCoupAttempt(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'coup_attempt' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const cost = 15;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);
  if (from.diplomaticInfluence < 10) return fail(action, 'Need 10+ diplomatic influence');

  from.economy.budget -= cost;
  from.diplomaticInfluence -= 10;

  // Success depends on target stability/approval — harder in stable countries
  const baseChance = (100 - target.stability) / 200 + (100 - target.approval) / 200;
  const success = Math.random() < baseChance;

  if (success) {
    target.stability = clamp(target.stability - 40, 0, 100);
    target.approval = 30 + Math.random() * 20; // new government starts ~40% approval
    target.military.army = Math.floor(target.military.army * 0.7); // army split
    target.economy.gdp *= 0.9;
    target.diplomaticInfluence = clamp(target.diplomaticInfluence - 20, 0, 100);

    // New puppet government is friendlier
    state.relations.push(makeDipRelation(state, 'alliance', fromCode, action.targetCountry));

    addEvent(state, 'civil_unrest',
      `Military coup in ${action.targetCountry}`,
      `The government of ${action.targetCountry} has been overthrown. New regime aligned with ${fromCode}.`,
      'critical', [fromCode, action.targetCountry]);

    return {
      success: true, action,
      message: `Coup in ${action.targetCountry} successful — puppet regime installed`,
      effects: [
        { description: `Budget -$${cost}B`, known: true },
        { description: 'Influence -10', known: true },
        { description: 'Government overthrown', known: true },
        { description: 'New allied regime in power', known: true },
        { description: 'Target stability -40', known: false },
        { description: 'Target army split (30% deserted)', known: false },
        { description: 'Resistance movements likely', known: false },
        { description: 'International sanctions possible', known: false },
      ],
    };
  } else {
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 15, 0, 100);
    target.stability = clamp(target.stability - 10, 0, 100); // still causes chaos

    addEvent(state, 'diplomatic_incident',
      `Failed coup attempt in ${action.targetCountry}`,
      `Foreign-backed coup attempt failed. ${fromCode} implicated.`,
      'critical', [fromCode, action.targetCountry]);

    return {
      success: true, action,
      message: `Coup attempt in ${action.targetCountry} failed — exposed`,
      effects: [
        { description: `Budget -$${cost}B`, known: true },
        { description: 'Influence -25 total (exposed)', known: true },
        { description: 'International condemnation', known: true },
        { description: 'Target now hostile', known: true },
        { description: 'War declaration likely', known: false },
      ],
    };
  }
}

// ══════════════════════════════════════════════════════════
// INFORMATION WARFARE
// ══════════════════════════════════════════════════════════

function processPropaganda(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'propaganda' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const cost = 3;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);

  from.economy.budget -= cost;

  const narrativeEffects: Record<string, () => void> = {
    anti_government: () => {
      target.approval = clamp(target.approval - 8, 0, 100);
      target.stability = clamp(target.stability - 3, 0, 100);
    },
    nationalism: () => {
      target.stability = clamp(target.stability - 5, 0, 100);
      target.approval = clamp(target.approval - 3, 0, 100);
    },
    separatism: () => {
      target.stability = clamp(target.stability - 10, 0, 100);
    },
    economic_fear: () => {
      target.economy.gdpGrowth -= 0.5;
      target.approval = clamp(target.approval - 5, 0, 100);
      target.economy.inflation += 0.5;
    },
  };

  narrativeEffects[action.narrative]?.();

  const labels: Record<string, string> = {
    anti_government: 'Anti-government sentiment spreading',
    nationalism: 'Ethnic tensions inflamed',
    separatism: 'Separatist movements empowered',
    economic_fear: 'Economic panic spreading',
  };

  return {
    success: true, action,
    message: `Propaganda campaign launched in ${action.targetCountry}`,
    effects: [
      { description: `Budget -$${cost}B`, known: true },
      { description: labels[action.narrative], known: false },
      { description: 'Social media campaigns active', known: false },
      { description: 'Long-term destabilization', known: false },
    ],
  };
}

function processFalseFlag(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'false_flag' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');
  const framed = state.countries[action.framedCountry];
  if (!framed) return fail(action, 'Framed country not in game');
  if (action.targetCountry === fromCode || action.framedCountry === fromCode) {
    return fail(action, 'Cannot false-flag yourself');
  }

  const cost = 12;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);
  if (from.diplomaticInfluence < 8) return fail(action, 'Need 8+ diplomatic influence');

  from.economy.budget -= cost;
  from.diplomaticInfluence -= 8;

  // Does the target believe it?
  const believability = 0.5 + (from.techLevel - target.techLevel) * 0.05;
  const believed = Math.random() < believability;

  if (believed) {
    // Target blames the framed country
    target.diplomaticInfluence = clamp(target.diplomaticInfluence - 5, 0, 100);
    framed.diplomaticInfluence = clamp(framed.diplomaticInfluence - 15, 0, 100);

    // Damage to target from the "attack"
    target.stability = clamp(target.stability - 10, 0, 100);
    target.economy.gdp -= target.economy.gdp * 0.01;

    // Create hostility between target and framed
    const existing = state.relations.find(r =>
      r.type === 'war' && r.status === 'active' &&
      ((r.fromCountry === action.targetCountry && r.toCountry === action.framedCountry) ||
       (r.fromCountry === action.framedCountry && r.toCountry === action.targetCountry)));

    if (!existing) {
      state.relations.push(makeDipRelation(state, 'sanction', action.targetCountry, action.framedCountry));
    }

    addEvent(state, 'diplomatic_incident',
      `${action.operation} attributed to ${action.framedCountry}`,
      `${action.targetCountry} blames ${action.framedCountry} for ${action.operation.replace(/_/g, ' ')}.`,
      'critical', [action.targetCountry, action.framedCountry]);

    return {
      success: true, action,
      message: `False flag successful — ${action.targetCountry} blames ${action.framedCountry}`,
      effects: [
        { description: `Budget -$${cost}B`, known: true },
        { description: 'Influence -8', known: true },
        { description: `${action.targetCountry} now hostile to ${action.framedCountry}`, known: false },
        { description: `${action.framedCountry} influence -15`, known: false },
        { description: 'Sanctions/war between targets possible', known: false },
        { description: 'Your involvement remains hidden', known: false },
      ],
    };
  } else {
    // Failed — investigators found the truth
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 20, 0, 100);
    from.approval = clamp(from.approval - 10, 0, 100);

    addEvent(state, 'political_scandal',
      `${fromCode} caught staging false flag in ${action.targetCountry}`,
      `Investigation reveals ${fromCode} staged a ${action.operation.replace(/_/g, ' ')} and tried to frame ${action.framedCountry}.`,
      'critical', [fromCode, action.targetCountry, action.framedCountry]);

    return {
      success: true, action,
      message: `False flag exposed — ${fromCode} caught and condemned`,
      effects: [
        { description: `Budget -$${cost}B`, known: true },
        { description: 'Influence -28 total (catastrophic)', known: true },
        { description: 'Approval -10', known: true },
        { description: 'Global condemnation', known: true },
        { description: 'Both targets now hostile to you', known: false },
      ],
    };
  }
}

// ══════════════════════════════════════════════════════════
// ARMS DEALS
// ══════════════════════════════════════════════════════════

function processArmsDeal(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'arms_deal' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const amount = Math.max(1, Math.min(20, action.amount));
  if (from.military.techLevel < 3) return fail(action, 'Need military tech 3+ to export arms');

  // Seller gets money, buyer gets military boost
  from.economy.budget += amount * 0.8; // profit margin
  from.economy.tradeBalance += amount;
  target.military.army += Math.floor(amount * 3000);
  target.military.techLevel = Math.min(from.military.techLevel - 1, target.military.techLevel + amount * 0.1);
  target.military.defenseBudget += amount * 0.5;

  from.diplomaticInfluence = clamp(from.diplomaticInfluence + 2, 0, 100);

  return {
    success: true, action,
    message: `Arms deal with ${action.targetCountry}: $${amount}B`,
    effects: [
      { description: `Revenue +$${(amount * 0.8).toFixed(1)}B`, known: true },
      { description: `Trade balance +$${amount}B`, known: true },
      { description: 'Influence +2', known: true },
      { description: `Target army +${Math.floor(amount * 3000)}`, known: true },
      { description: 'Arms proliferation risk', known: false },
      { description: 'Buyer may become future threat', known: false },
    ],
  };
}

// ── Helpers ──

// ══════════════════════════════════════════════════════════
// SANCTION EVASION
// ══════════════════════════════════════════════════════════

function processSanctionEvasion(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'sanction_evasion' },
): ActionResult {
  const methods: Record<string, { cost: number; evasionBoost: number; techReq: number; desc: string }> = {
    shadow_fleet: { cost: 5, evasionBoost: 15, techReq: 0, desc: 'Shadow tanker fleet assembled. Oil exports routed through unregistered vessels.' },
    crypto_bypass: { cost: 3, evasionBoost: 10, techReq: 5, desc: 'Cryptocurrency channels established for cross-border transactions.' },
    parallel_import: { cost: 8, evasionBoost: 20, techReq: 0, desc: 'Grey import channels established through partner countries.' },
    import_substitution: { cost: 20, evasionBoost: 25, techReq: 4, desc: 'Domestic production programs launched to reduce import dependency.' },
  };

  const m = methods[action.method];
  if (!m) return fail(action, 'Unknown evasion method');
  if (from.economy.budget < m.cost) return fail(action, `Need $${m.cost}B budget`);
  if (from.techLevel < m.techReq) return fail(action, `Need tech level ${m.techReq}+`);

  from.economy.budget -= m.cost;
  from.economy.sanctionEvasion = Math.min(90, from.economy.sanctionEvasion + m.evasionBoost);

  // Parallel import requires existing trade agreements
  if (action.method === 'parallel_import') {
    const hasTradePartner = state.relations.some(
      r => (r.fromCountry === fromCode || r.toCountry === fromCode) &&
           r.type === 'trade_agreement' && r.status === 'active'
    );
    if (!hasTradePartner) {
      from.economy.sanctionEvasion -= m.evasionBoost; // revert
      from.economy.budget += m.cost; // refund
      return fail(action, 'Need at least one active trade agreement for parallel import');
    }
  }

  // Import substitution also builds resilience
  if (action.method === 'import_substitution') {
    from.economy.sanctionResilience = Math.min(90, from.economy.sanctionResilience + 10);
  }

  return {
    success: true, action,
    message: m.desc,
    effects: [
      { description: `Budget -$${m.cost}B`, known: true },
      { description: `Sanction evasion +${m.evasionBoost}`, known: true },
      ...(action.method === 'import_substitution' ? [{ description: 'Resilience +10', known: true }] : []),
      { description: 'Detection risk by sanctioners', known: false },
      { description: 'Long-term effectiveness may vary', known: false },
    ],
  };
}

// ── Resource system actions (v0.2) ──

function processSmuggle(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'smuggle' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const methodCosts: Record<string, number> = {
    land_border: 2, sea_route: 4, intermediary_country: 6, diplomatic_pouch: 1,
  };
  const detectionChances: Record<string, number> = {
    land_border: 0.15, sea_route: 0.25, intermediary_country: 0.10, diplomatic_pouch: 0.05,
  };
  const maxAmounts: Record<string, number> = {
    land_border: 10, sea_route: 20, intermediary_country: 15, diplomatic_pouch: 2,
  };

  const cost = methodCosts[action.method] ?? 3;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);

  const amount = Math.min(action.amount, maxAmounts[action.method] ?? 10);
  const detection = detectionChances[action.method] ?? 0.2;

  from.economy.budget -= cost;

  // Create smuggle route as relation
  const relation = makeDipRelation(state, 'smuggle_route' as any, fromCode, action.targetCountry);
  relation.expiresAtTick = state.session.currentTick + 6;
  (relation as any).tradeFlows = [{
    resource: action.resource,
    amountPerTick: amount,
    direction: 'to_from' as const, // target exports to player
    priceModifier: 0.7, // contraband is cheaper
  }];
  (relation as any).smuggleMethod = action.method;
  (relation as any).smuggleDetectionChance = detection;
  state.relations.push(relation);

  return {
    success: true, action,
    message: `Contraband route for ${action.resource} established with ${action.targetCountry}`,
    effects: [
      { description: `Budget -$${cost}B`, known: true },
      { description: `${action.resource} x${amount}/mo via ${action.method}`, known: true },
      { description: `Detection risk: ${(detection * 100).toFixed(0)}%/month`, known: true },
      { description: 'Bypasses sanctions', known: true },
      { description: 'Diplomatic scandal if discovered', known: false },
    ],
  };
}

function processResourceTheft(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'resource_theft' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const methodConfig: Record<string, { cost: number; risk: number; amount: number; techReq: number }> = {
    cyber_siphon: { cost: 5, risk: 0.30, amount: 5, techReq: 7 },
    piracy: { cost: 3, risk: 0.20, amount: 8, techReq: 3 },
    illegal_mining: { cost: 2, risk: 0.10, amount: 3, techReq: 3 },
    pipeline_tap: { cost: 4, risk: 0.25, amount: 10, techReq: 4 },
  };

  const cfg = methodConfig[action.method];
  if (!cfg) return fail(action, 'Unknown theft method');
  if (from.economy.budget < cfg.cost) return fail(action, `Need $${cfg.cost}B budget`);
  if (from.techLevel < cfg.techReq) return fail(action, `Need tech level ${cfg.techReq}+`);

  from.economy.budget -= cfg.cost;

  // Detection check
  const detected = Math.random() < cfg.risk;

  if (detected) {
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 15, 0, 100);
    target.approval = clamp(target.approval + 5, 0, 100); // rally effect

    addEvent(state, 'resource_theft_detected',
      `${fromCode} caught stealing ${action.resource} from ${action.targetCountry}`,
      `${action.method} operation exposed. Diplomatic fallout expected.`,
      'high', [fromCode, action.targetCountry]);

    return {
      success: false, action,
      message: `${action.method} detected! Diplomatic scandal.`,
      effects: [
        { description: `Budget -$${cfg.cost}B`, known: true },
        { description: 'Operation exposed!', known: true },
        { description: 'Influence -15', known: true, value: '-15' },
        { description: 'War casus belli given to target', known: true },
      ],
    };
  }

  // Success — steal resources
  const targetBal = target.resourceState?.[action.resource];
  if (targetBal) {
    targetBal.production = Math.max(0, targetBal.production - cfg.amount * 0.5);
  }

  // Give to thief (will show up in next resource tick as production boost)
  if (!from.resourceState) from.resourceState = {};
  const fromBal = from.resourceState[action.resource] ?? {
    production: 0, consumption: 0, imported: 0, exported: 0, smuggled: 0, deficit: 0, stockpile: 0,
  };
  fromBal.imported += cfg.amount; // treat as "imported" for this tick
  from.resourceState[action.resource] = fromBal;

  return {
    success: true, action,
    message: `${action.method}: stole ${cfg.amount} units of ${action.resource} from ${action.targetCountry}`,
    effects: [
      { description: `Budget -$${cfg.cost}B`, known: true },
      { description: `Acquired ${cfg.amount} ${action.resource}`, known: true },
      { description: `Target production damaged`, known: false },
      { description: `Detection risk was ${(cfg.risk * 100).toFixed(0)}%`, known: false },
    ],
  };
}

function processBuildStockpile(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'build_stockpile' },
): ActionResult {
  const months = clamp(action.months, 1, 12);

  if (!from.resourceState) from.resourceState = {};
  const bal = from.resourceState[action.resource] ?? {
    production: 0, consumption: 0, imported: 0, exported: 0, smuggled: 0, deficit: 0, stockpile: 0,
  };

  // Cost = months of consumption × price factor
  const price = state.resourceMarket?.prices?.[action.resource] ?? 100;
  const consumption = Math.max(1, bal.consumption);
  const cost = months * consumption * price * 0.005; // scale down to budget units

  if (from.economy.budget < cost) return fail(action, `Need $${cost.toFixed(1)}B budget`);
  if (bal.stockpile + months > 12) return fail(action, `Max 12 months stockpile (current: ${bal.stockpile.toFixed(1)})`);

  from.economy.budget -= cost;
  bal.stockpile += months;
  from.resourceState[action.resource] = bal;

  return {
    success: true, action,
    message: `Built ${months}-month strategic reserve of ${action.resource}`,
    effects: [
      { description: `Budget -$${cost.toFixed(1)}B`, known: true },
      { description: `${action.resource} stockpile: ${bal.stockpile.toFixed(1)} months`, known: true },
      { description: 'Buffer against supply disruptions', known: true },
    ],
  };
}

function processManipulatePrice(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'manipulate_price' },
): ActionResult {
  // Check producer — need significant production capacity
  const res = (from.resources as unknown as Record<string, number>)[action.resource] ?? 0;
  if (res < 30) return fail(action, `Need at least 30 production capacity to manipulate ${action.resource} price (have ${res})`);

  const cost = 3;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);
  from.economy.budget -= cost;

  const market = state.resourceMarket;
  const currentPrice = market.prices[action.resource] ?? 100;

  switch (action.method) {
    case 'production_cut': {
      // Reduce own production → reduce supply → price up
      const bal = from.resourceState?.[action.resource];
      if (bal) bal.production *= 0.7; // cut 30%
      // Price will adjust next tick via supply/demand
      from.economy.tradeBalance -= 2; // short-term revenue loss

      addEvent(state, 'price_manipulation',
        `${fromCode} cuts ${action.resource} production`,
        `Production cut expected to drive up ${action.resource} prices globally.`,
        'medium', [fromCode]);

      return {
        success: true, action,
        message: `Production cut: ${action.resource} output -30%`,
        effects: [
          { description: 'Production -30% this tick', known: true },
          { description: 'Global price expected to rise', known: true },
          { description: 'Short-term revenue loss', known: true },
          { description: 'OPEC-style market influence', known: false },
        ],
      };
    }

    case 'dump_stockpile': {
      const bal = from.resourceState?.[action.resource];
      if (!bal || bal.stockpile < 1) return fail(action, 'No stockpile to dump');
      bal.stockpile -= 1;
      // Increase supply → price down (will process next tick)
      bal.production += bal.consumption * 2; // temporary boost

      return {
        success: true, action,
        message: `Dumped ${action.resource} reserves — prices should drop`,
        effects: [
          { description: 'Stockpile -1 month', known: true },
          { description: 'Supply flooded — price drop expected', known: true },
          { description: 'Competitors may suffer', known: false },
        ],
      };
    }

    case 'cartel_coordination': {
      // Need alliance with other producers
      const allies = state.relations.filter(r =>
        r.type === 'alliance' && r.status === 'active' &&
        (r.fromCountry === fromCode || r.toCountry === fromCode)
      );
      if (allies.length === 0) return fail(action, 'Need at least one allied country for cartel');

      // Reduce all allied producers' output
      for (const ally of allies) {
        const allyCode = ally.fromCountry === fromCode ? ally.toCountry : ally.fromCountry;
        const allyCountry = state.countries[allyCode];
        if (!allyCountry) continue;
        const allyRes = (allyCountry.resources as unknown as Record<string, number>)[action.resource] ?? 0;
        if (allyRes > 20) {
          const allyBal = allyCountry.resourceState?.[action.resource];
          if (allyBal) allyBal.production *= 0.8; // 20% cut
        }
      }

      // Own cut
      const bal = from.resourceState?.[action.resource];
      if (bal) bal.production *= 0.8;

      addEvent(state, 'price_manipulation',
        `${fromCode} coordinates ${action.resource} cartel`,
        `Cartel formed to manipulate ${action.resource} prices. Multiple producers cutting output.`,
        'high', [fromCode]);

      return {
        success: true, action,
        message: `Cartel coordination: ${action.resource} — all producers cut 20%`,
        effects: [
          { description: 'Cartel production cuts', known: true },
          { description: 'Major price spike expected', known: true },
          { description: 'Importers will suffer', known: false },
          { description: 'Cartel may fracture', known: false },
        ],
      };
    }

    default:
      return fail(action, 'Unknown manipulation method');
  }
}

// ── Intelligence action processors (v0.3) ──

function processLaunchSpyOp(
  state: GameState,
  country: CountryState,
  playerCountryCode: string,
  action: PlayerAction & { type: 'launch_spy_op' },
): ActionResult {
  if (!country.intel) return fail(action, 'Intelligence system not initialized');

  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not found');
  if (action.targetCountry === playerCountryCode) return fail(action, 'Cannot spy on yourself');

  const config = SPY_OP_CONFIG[action.opType];
  if (!config) return fail(action, 'Unknown spy operation type');

  // Check tech level
  if ((country.techLevel ?? 1) < config.techRequired) {
    return fail(action, `Requires tech level ${config.techRequired} (you have ${country.techLevel ?? 1})`);
  }

  // Check budget
  if (country.economy.budget < config.cost) {
    return fail(action, `Insufficient budget: need $${config.cost}B, have $${country.economy.budget.toFixed(1)}B`);
  }

  // Check max concurrent ops per target (limit 3)
  const dossier = country.intel.dossiers[action.targetCountry];
  if (dossier && dossier.activeOps.length >= 3) {
    return fail(action, 'Maximum 3 concurrent operations per target');
  }

  // Deduct cost
  country.economy.budget -= config.cost;

  // Create spy operation
  const op = {
    id: `spy-${playerCountryCode}-${action.targetCountry}-${Date.now()}`,
    type: action.opType,
    targetCountry: action.targetCountry,
    duration: config.baseDuration,
    detectionRisk: config.detectionRisk,
    reveals: config.reveals,
    startedTick: state.session.currentTick,
  };

  // Ensure dossier exists
  if (!country.intel.dossiers[action.targetCountry]) {
    country.intel.dossiers[action.targetCountry] = {
      level: 'none',
      intelPoints: 0,
      activeOps: [],
      lastUpdated: state.session.currentTick,
      revealed: { economy: false, military: false, resources: false, diplomacy: false, stability: false },
    };
  }
  country.intel.dossiers[action.targetCountry].activeOps.push(op);

  const effects: ActionEffect[] = [
    { description: `${action.opType} operation launched against ${action.targetCountry}`, known: true },
    { description: `Cost: $${config.cost}B`, known: true, value: `-$${config.cost}B` },
    { description: `Duration: ${config.baseDuration} months`, known: true },
    { description: `Detection risk: ${(config.detectionRisk * 100).toFixed(0)}% per tick`, known: true },
    { description: 'Target counterintelligence may detect operation', known: false },
  ];

  return { success: true, action, message: `Spy operation launched`, effects };
}

function processBoostCounterIntel(
  country: CountryState,
  action: PlayerAction & { type: 'boost_counter_intel' },
): ActionResult {
  if (!country.intel) return fail(action, 'Intelligence system not initialized');

  const amount = action.amount;
  if (amount <= 0 || amount > 20) return fail(action, 'Investment must be between $1B and $20B');

  if (country.economy.budget < amount) {
    return fail(action, `Insufficient budget: need $${amount}B, have $${country.economy.budget.toFixed(1)}B`);
  }

  country.economy.budget -= amount;

  // Each $1B gives +2 counterintel points, diminishing returns above 70
  const current = country.intel.counterIntel;
  const efficiency = current > 70 ? 0.5 : 1.0;
  const boost = amount * 2 * efficiency;
  country.intel.counterIntel = Math.min(100, current + boost);

  const effects: ActionEffect[] = [
    { description: `Counterintelligence: ${current.toFixed(0)} → ${country.intel.counterIntel.toFixed(0)}`, known: true, value: `+${boost.toFixed(0)}` },
    { description: `Cost: $${amount}B`, known: true, value: `-$${amount}B` },
    { description: 'Reduces enemy spy detection success', known: true },
  ];

  return { success: true, action, message: `Counterintelligence boosted`, effects };
}

function processLaunchDisinfo(
  state: GameState,
  country: CountryState,
  action: PlayerAction & { type: 'launch_disinfo' },
): ActionResult {
  if (!country.intel) return fail(action, 'Intelligence system not initialized');

  const { category, multiplier, duration } = action;

  // Validate category
  const validCategories = ['economy', 'military', 'resources', 'diplomacy', 'stability'];
  if (!validCategories.includes(category)) return fail(action, `Invalid category: ${category}`);

  // Validate multiplier (0.5-2.0)
  if (multiplier < 0.5 || multiplier > 2.0) return fail(action, 'Multiplier must be between 0.5 and 2.0');

  // Validate duration (1-12 months)
  if (duration < 1 || duration > 12) return fail(action, 'Duration must be 1-12 months');

  // Cost scales with duration and deviation from reality
  const deviation = Math.abs(multiplier - 1.0);
  const cost = deviation * duration * 3; // $3B per deviation unit per month
  if (country.economy.budget < cost) {
    return fail(action, `Insufficient budget: need $${cost.toFixed(1)}B`);
  }

  // Check for existing disinfo on same category
  const existing = country.intel.disinfo.findIndex(d => d.category === category);
  if (existing >= 0) {
    country.intel.disinfo.splice(existing, 1); // replace
  }

  country.economy.budget -= cost;

  country.intel.disinfo.push({
    id: `disinfo-${country.code}-${category}-${Date.now()}`,
    category,
    multiplier,
    duration,
    startedTick: state.session.currentTick,
  });

  const direction = multiplier > 1 ? 'inflated' : 'deflated';
  const effects: ActionEffect[] = [
    { description: `${category} data will appear ${direction} by ${((multiplier - 1) * 100).toFixed(0)}%`, known: true },
    { description: `Duration: ${duration} months`, known: true },
    { description: `Cost: $${cost.toFixed(1)}B`, known: true, value: `-$${cost.toFixed(1)}B` },
    { description: 'Enemy spies will see manipulated data', known: true },
    { description: 'Effect depends on enemy intel level', known: false },
  ];

  return { success: true, action, message: `Disinformation campaign launched on ${category}`, effects };
}

function processSetIntelBudget(
  country: CountryState,
  action: PlayerAction & { type: 'set_intel_budget' },
): ActionResult {
  if (!country.intel) return fail(action, 'Intelligence system not initialized');

  const budget = action.budget;
  if (budget < 0 || budget > 50) return fail(action, 'Intel budget must be between $0B and $50B per tick');

  const old = country.intel.intelBudget;
  country.intel.intelBudget = budget;

  const effects: ActionEffect[] = [
    { description: `Intel budget: $${old.toFixed(1)}B → $${budget.toFixed(1)}B per tick`, known: true, value: `$${budget}B` },
    { description: 'Deducted from national budget each tick', known: true },
  ];

  return { success: true, action, message: `Intelligence budget set to $${budget}B/tick`, effects };
}

function isAtWar(state: GameState, c1: string, c2: string): boolean {
  return state.relations.some(
    r => r.type === 'war' && r.status === 'active' &&
    ((r.fromCountry === c1 && r.toCountry === c2) || (r.fromCountry === c2 && r.toCountry === c1))
  );
}

function fail(action: PlayerAction, message: string): ActionResult {
  return { success: false, action, message, effects: [] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
