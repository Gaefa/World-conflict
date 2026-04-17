import type {
  PlayerAction,
  ActionResult,
  GameState,
  CountryState,
} from '@conflict-game/shared-types';
import { addEvent, clamp, fail, makeDipRelation } from './_helpers';

// ── Resource system actions (v0.2) ──

export function processSmuggle(
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

export function processResourceTheft(
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

export function processBuildStockpile(
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

export function processManipulatePrice(
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
