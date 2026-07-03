import type {
  PlayerAction,
  ActionResult,
  ActionEffect,
  GameState,
  CountryState,
} from '@conflict-game/shared-types';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import { recruitmentCost } from '@conflict-game/game-logic';
import { addEvent, clamp, fail, isAtWar, makeDipRelation, scaledCost } from './_helpers';

export function processCreateArmy(
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

export function processMoveArmy(
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

// ══════════════════════════════════════════════════════════
// MILITARY OPERATIONS
// ══════════════════════════════════════════════════════════

export function processAirstrike(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'airstrike' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  // War not required (2026 reality) but being at war reduces diplomatic cost
  const atWar = isAtWar(state, fromCode, action.targetCountry);

  if (from.military.airForce < 10) return fail(action, 'Insufficient air force');

  const baseCosts: Record<string, { budget: number; planes: number }> = {
    surgical: { budget: 2, planes: 5 },
    conventional: { budget: 8, planes: 20 },
    carpet: { budget: 20, planes: 50 },
  };
  const base = baseCosts[action.intensity];
  const c = { budget: scaledCost(base.budget, from.economy.gdp), planes: base.planes };
  if (from.economy.budget < c.budget) return fail(action, `Need $${c.budget.toFixed(1)}B budget`);
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

/**
 * Invasion = deploying an expeditionary force. Troops are detached from the
 * country's army reserve into a real Army unit that marches on the enemy
 * capital. Resolution happens through the military tick: battles with
 * defenders en route, then occupation → capitulation. No instant dice-roll.
 */
export function processInvasion(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'invasion' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');
  if (fromCode === action.targetCountry) return fail(action, 'Cannot invade yourself');

  const home = SEED_COUNTRIES.find(c => c.code === fromCode);
  const enemy = SEED_COUNTRIES.find(c => c.code === action.targetCountry);
  if (!home || !enemy) return fail(action, 'Country coordinates unavailable');

  const forces = Math.max(0.1, Math.min(1.0, action.committedForces));
  const committedTroops = Math.floor(from.military.army * forces);
  if (committedTroops < 1000) return fail(action, 'Need at least 1,000 troops');

  const cost = committedTroops * 0.00005; // ~$50K per soldier
  if (from.economy.budget < cost) return fail(action, `Need $${cost.toFixed(1)}B for operation`);

  // War not required but invading without declaration = massive diplomatic hit
  const atWar = isAtWar(state, fromCode, action.targetCountry);
  if (!atWar) {
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 25, 0, 100);
    from.approval = clamp(from.approval - 15, 0, 100);
  }

  from.economy.budget -= cost;
  from.military.army -= committedTroops; // detached from the reserve
  // War weariness: launching an expedition destabilizes the home front
  // (the old instant-battle invasion cost -5/-15 stability; keep that price)
  from.stability = clamp(from.stability - 4, 0, 100);

  state.armies.push({
    id: `army-${fromCode}-${Date.now()}`,
    ownerCountry: fromCode,
    sessionId: state.session.id,
    name: `Expeditionary Force ${action.targetCountry}`,
    type: 'infantry',
    size: committedTroops,
    latitude: home.latitude,
    longitude: home.longitude,
    targetLatitude: enemy.latitude,
    targetLongitude: enemy.longitude,
    morale: 85,
    experience: Math.min(50, from.military.techLevel * 5),
    status: 'moving',
    createdAtTick: state.session.currentTick,
  });

  // Rough ETA at infantry speed (4°/tick), for the player's expectations
  const dLat = home.latitude - enemy.latitude;
  let dLng = Math.abs(home.longitude - enemy.longitude);
  if (dLng > 180) dLng = 360 - dLng;
  const etaTicks = Math.max(1, Math.ceil(Math.sqrt(dLat * dLat + dLng * dLng) / 4));

  addEvent(state, 'military_incident',
    `${fromCode} invades ${action.targetCountry}`,
    `${fromCode} deployed ${committedTroops.toLocaleString()} troops toward ${action.targetCountry}'s capital.`,
    'critical', [fromCode, action.targetCountry]);

  return {
    success: true, action,
    message: `Expeditionary force marching on ${action.targetCountry}`,
    effects: [
      { description: `Budget -$${cost.toFixed(1)}B`, known: true },
      { description: `Committed ${committedTroops.toLocaleString()} troops`, known: true },
      { description: 'Stability -4', known: true, value: '-4' },
      { description: `ETA ~${etaTicks} months — track it on the war map`, known: true },
      { description: 'Occupy their capital to force capitulation', known: true },
      ...(!atWar ? [{ description: 'No war declaration — Influence -25, Approval -15', known: true }] : []),
      { description: 'Defending armies may intercept en route', known: false },
      { description: 'Allied nations may intervene', known: false },
    ],
  };
}

export function processNuclearStrike(
  state: GameState,
  from: CountryState,
  fromCode: string,
  action: PlayerAction & { type: 'nuclear_strike' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const researched = from.tech?.researchedTechs ?? [];
  if (action.warhead === 'tactical' && !researched.includes('mil_9'))
    return fail(action, 'Tactical nuclear weapons require Tactical Nukes (mil_9)');
  if (action.warhead === 'strategic' && !researched.includes('mil_10'))
    return fail(action, 'Strategic strike requires Strategic Nuclear Arsenal (mil_10)');

  const warhadsNeeded = action.warhead === 'tactical' ? 1 : 3;
  if (from.military.nuclearWeapons < warhadsNeeded)
    return fail(action, `Need ${warhadsNeeded} warhead(s), have ${from.military.nuclearWeapons}`);

  from.military.nuclearWeapons -= warhadsNeeded;
  from.diplomaticInfluence = clamp(from.diplomaticInfluence - 30, 0, 100);
  from.approval = clamp(from.approval - 20, 0, 100);

  if (action.warhead === 'tactical') {
    target.military.army = Math.floor(target.military.army * 0.6);
    target.stability = clamp(target.stability - 30, 0, 100);
    target.approval = clamp(target.approval - 15, 0, 100);
    addEvent(state, 'military_incident',
      `☢ Tactical nuclear strike on ${action.targetCountry}`,
      `${fromCode} launched a tactical nuclear strike on ${action.targetCountry}. Military forces devastated.`,
      'critical', [fromCode, action.targetCountry]);
  } else {
    target.economy.gdp *= 0.4;
    target.military.army = Math.floor(target.military.army * 0.3);
    target.stability = clamp(target.stability - 50, 0, 100);
    target.approval = clamp(target.approval - 30, 0, 100);
    // Global nuclear fallout — every country takes stability/approval hit
    for (const [code, country] of Object.entries(state.countries)) {
      if (code === fromCode || code === action.targetCountry) continue;
      country.stability = clamp(country.stability - 5, 0, 100);
      country.approval = clamp(country.approval - 5, 0, 100);
      country.diplomaticInfluence = clamp(country.diplomaticInfluence - 5, 0, 100);
    }
    addEvent(state, 'military_incident',
      `☢☢ STRATEGIC NUCLEAR STRIKE on ${action.targetCountry}`,
      `${fromCode} has launched a strategic nuclear strike. Global fallout. International emergency.`,
      'critical', Object.keys(state.countries));
  }

  return {
    success: true, action,
    message: `${action.warhead === 'tactical' ? 'Tactical' : 'Strategic'} nuclear strike on ${action.targetCountry}`,
    effects: [
      { description: `${warhadsNeeded} warhead(s) expended`, known: true },
      { description: 'Diplomatic influence -30', known: true, value: '-30' },
      { description: action.warhead === 'strategic' ? 'Global fallout — all countries affected' : 'Target military -40%', known: true },
      { description: 'Permanent international condemnation', known: false },
      { description: 'Retaliation strike possible', known: false },
    ],
  };
}

export function processDroneRaid(
  state: GameState,
  from: CountryState,
  fromCode: string,
  action: PlayerAction & { type: 'drone_raid' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');
  if (!(from.tech?.researchedTechs ?? []).includes('mil_3'))
    return fail(action, 'Drone Warfare technology (mil_3) required');

  const cost = scaledCost(3, from.economy.gdp);
  if (from.economy.budget < cost) return fail(action, `Need $${cost.toFixed(1)}B budget`);
  from.economy.budget -= cost;

  const atWar = isAtWar(state, fromCode, action.targetCountry);
  if (!atWar) from.diplomaticInfluence = clamp(from.diplomaticInfluence - 8, 0, 100);

  const effects: ActionEffect[] = [{ description: `Budget -$${cost}B`, known: true }];

  switch (action.target) {
    case 'military':
      target.military.army = Math.floor(target.military.army * 0.95);
      effects.push({ description: 'Target army -5%', known: true });
      break;
    case 'infrastructure':
      target.economy.gdp *= 0.98;
      target.economy.gdpGrowth -= 0.2;
      effects.push({ description: 'Target GDP -2%, growth -0.2%', known: true });
      break;
    case 'leadership':
      target.approval = clamp(target.approval - 10, 0, 100);
      target.stability = clamp(target.stability - 5, 0, 100);
      effects.push({ description: 'Target approval -10, stability -5', known: true });
      break;
  }

  addEvent(state, 'military_incident',
    `Drone raid on ${action.targetCountry}`,
    `${fromCode} launched drone strikes targeting ${action.target} in ${action.targetCountry}.`,
    'high', [fromCode, action.targetCountry]);

  if (!atWar) effects.push({ description: 'Influence -8 (undeclared strike)', known: true, value: '-8' });
  effects.push({ description: 'Retaliation possible', known: false });

  return { success: true, action, message: `Drone raid on ${action.targetCountry} (${action.target})`, effects };
}

export function processNavalBlockade(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'naval_blockade' },
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  if (from.military.navy < 20) return fail(action, 'Need at least 20 naval vessels');

  const cost = scaledCost(5, from.economy.gdp);
  if (from.economy.budget < cost) return fail(action, `Need $${cost.toFixed(1)}B budget`);

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
