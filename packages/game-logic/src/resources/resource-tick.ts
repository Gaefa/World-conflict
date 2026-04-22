import type {
  GameState,
  ResourceMarket,
  ResourceType,
  RawResource,
  ProcessedResource,
  ResourceBalance,
  CountryState,
  ProcessingChain,
  DiplomaticRelation,
  GameEvent,
} from '@conflict-game/shared-types';
import type { RNG } from '../rng';

// ── Constants ──

const RAW_RESOURCES: RawResource[] = [
  'oil', 'gas', 'coal',
  'iron', 'copper', 'aluminum', 'titanium',
  'gold', 'silver', 'palladium', 'platinum',
  'diamonds', 'gemstones',
  'rareEarth', 'lithium', 'cobalt',
  'uranium',
  'timber', 'rareWood',
  'wheat', 'rice', 'fish', 'freshWater',
];

/** Base consumption rates per resource type (scaled by population & GDP) */
const BASE_CONSUMPTION: Record<string, number> = {
  // Energy — high demand
  oil: 12, gas: 10, coal: 6,
  // Industrial metals
  iron: 5, copper: 4, aluminum: 3, titanium: 1,
  // Precious — low base, luxury-driven
  gold: 0.5, silver: 0.5, palladium: 0.1, platinum: 0.1,
  // Luxury
  diamonds: 0.2, gemstones: 0.2,
  // Strategic minerals — tech-driven
  rareEarth: 2, lithium: 1.5, cobalt: 0.8,
  // Nuclear
  uranium: 0.3,
  // Forestry
  timber: 4, rareWood: 0.5,
  // Agriculture — population-driven
  wheat: 15, rice: 12, fish: 6, freshWater: 20,
  // Processed — consumed by advanced economies
  steel: 8, electronics: 5, semiconductors: 3,
  refinedOil: 10, nuclearFuel: 0.2,
  luxuryGoods: 1, weaponsComponents: 2,
  pharmaceuticals: 3, fertilizer: 4,
};

/** Market base prices ($/unit, base=100) */
const BASE_PRICES: Record<string, number> = {
  oil: 100, gas: 80, coal: 50,
  iron: 60, copper: 70, aluminum: 65, titanium: 120,
  gold: 150, silver: 80, palladium: 140, platinum: 160,
  diamonds: 200, gemstones: 130,
  rareEarth: 180, lithium: 160, cobalt: 140,
  uranium: 120,
  timber: 40, rareWood: 100,
  wheat: 30, rice: 35, fish: 45, freshWater: 20,
  steel: 70, electronics: 120, semiconductors: 250,
  refinedOil: 110, nuclearFuel: 200,
  luxuryGoods: 180, weaponsComponents: 200,
  pharmaceuticals: 150, fertilizer: 50,
};

/** Resource category weights for economic impact */
const DEFICIT_IMPACT: Record<string, { gdp: number; inflation: number; stability: number; approval: number }> = {
  // Energy deficits hit GDP and inflation hard
  oil: { gdp: 0.8, inflation: 0.8, stability: 0.3, approval: 0.3 },
  gas: { gdp: 0.6, inflation: 0.6, stability: 0.2, approval: 0.2 },
  coal: { gdp: 0.3, inflation: 0.3, stability: 0.1, approval: 0.1 },
  refinedOil: { gdp: 0.7, inflation: 0.7, stability: 0.3, approval: 0.3 },
  // Food/water deficits destroy stability
  wheat: { gdp: 0.2, inflation: 0.4, stability: 0.8, approval: 0.8 },
  rice: { gdp: 0.2, inflation: 0.4, stability: 0.8, approval: 0.8 },
  fish: { gdp: 0.1, inflation: 0.2, stability: 0.3, approval: 0.3 },
  freshWater: { gdp: 0.3, inflation: 0.3, stability: 1.0, approval: 1.0 },
  fertilizer: { gdp: 0.3, inflation: 0.3, stability: 0.4, approval: 0.3 },
  // Strategic — slow GDP
  rareEarth: { gdp: 0.5, inflation: 0.2, stability: 0.1, approval: 0.1 },
  lithium: { gdp: 0.3, inflation: 0.1, stability: 0.05, approval: 0.05 },
  semiconductors: { gdp: 0.6, inflation: 0.3, stability: 0.1, approval: 0.1 },
  electronics: { gdp: 0.4, inflation: 0.2, stability: 0.1, approval: 0.1 },
  weaponsComponents: { gdp: 0.2, inflation: 0.1, stability: 0.2, approval: 0.1 },
  // Luxury — minor
  diamonds: { gdp: 0.05, inflation: 0.02, stability: 0.02, approval: 0.05 },
  luxuryGoods: { gdp: 0.1, inflation: 0.05, stability: 0.05, approval: 0.1 },
};

const DEFAULT_IMPACT = { gdp: 0.2, inflation: 0.1, stability: 0.1, approval: 0.1 };

// ── Helpers ──

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getBalance(state: CountryState, r: ResourceType): ResourceBalance {
  return state.resourceState[r] ?? {
    production: 0, consumption: 0, imported: 0, exported: 0,
    smuggled: 0, deficit: 0, stockpile: 0,
  };
}

function hasActiveSanctionOrBlockade(
  relations: DiplomaticRelation[],
  countryA: string,
  countryB: string,
): boolean {
  return relations.some(rel =>
    rel.status === 'active' &&
    (rel.type === 'sanction' || rel.type === 'naval_blockade') &&
    ((rel.fromCountry === countryA && rel.toCountry === countryB) ||
     (rel.fromCountry === countryB && rel.toCountry === countryA))
  );
}

// ── Main tick ──

export interface ResourceTickResult {
  resourceMarket: ResourceMarket;
  events: GameEvent[];
}

/**
 * Process one resource tick for the entire game state.
 * Mutates country resourceState, economy fields. Returns updated market + events.
 */
export function processResourceTick(state: GameState, rng: RNG): ResourceTickResult {
  const events: GameEvent[] = [];
  const allResources = Object.keys(BASE_CONSUMPTION) as ResourceType[];

  // ── Step 1: Raw production ──
  for (const [code, country] of Object.entries(state.countries)) {
    if (!country.resourceState) country.resourceState = {};

    for (const r of RAW_RESOURCES) {
      const capacity = (country.resources as unknown as Record<string, number>)[r] ?? 0;
      const bal = getBalance(country, r);
      bal.production = capacity * 0.5; // capacity 0-100 → 0-50 units/tick
      bal.imported = 0;
      bal.exported = 0;
      bal.smuggled = 0;
      country.resourceState[r] = bal;
    }
  }

  // ── Step 2: Processing chains ──
  for (const [code, country] of Object.entries(state.countries)) {
    if (!country.processingCapabilities) continue;

    for (const chain of state.processingChains) {
      if (!country.processingCapabilities.includes(chain.output)) continue;
      if (country.techLevel < chain.techRequired) continue;

      // Check all inputs available (use at most 50% of raw production for processing)
      let bottleneck = chain.capacityPerTick;
      for (const input of chain.inputs) {
        const inputBal = getBalance(country, input.resource);
        const available = (inputBal.production * 0.5) + inputBal.imported + inputBal.smuggled;
        const maxFromInput = available / input.amount;
        bottleneck = Math.min(bottleneck, maxFromInput);
      }
      bottleneck = Math.max(0, bottleneck);

      // Record input consumption (added to resource consumption in Step 3)
      for (const input of chain.inputs) {
        const inputBal = getBalance(country, input.resource);
        inputBal.consumption += bottleneck * input.amount; // processing consumes raw inputs
        country.resourceState[input.resource] = inputBal;
      }

      // Produce output
      const outBal = getBalance(country, chain.output);
      outBal.production += bottleneck;
      country.resourceState[chain.output] = outBal;
    }
  }

  // ── Step 3: Consumption ──
  for (const [code, country] of Object.entries(state.countries)) {
    // Approximate: use GDP as proxy for development level (population isn't on CountryState)
    const gdpFactor = country.economy.gdp / 2000; // normalize to ~1 for $2T economy
    const techFactor = country.techLevel / 5; // tech=5 → 1.0, tech=10 → 2.0

    for (const r of allResources) {
      const baseRate = BASE_CONSUMPTION[r] ?? 1;
      const bal = getBalance(country, r);

      // Higher-tech countries consume more processed goods, less raw
      let consumption: number;
      if (['semiconductors', 'electronics', 'pharmaceuticals', 'luxuryGoods'].includes(r)) {
        consumption = baseRate * gdpFactor * techFactor * 0.3;
      } else if (['wheat', 'rice', 'fish', 'freshWater'].includes(r)) {
        // Food/water: driven more by GDP (proxy for population scale)
        consumption = baseRate * gdpFactor * 0.5;
      } else {
        consumption = baseRate * gdpFactor * (techFactor * 0.5) * 0.3;
      }

      bal.consumption = Math.max(0.1, consumption);
      country.resourceState[r] = bal;
    }
  }

  // ── Step 4: Trade flows ──
  for (const rel of state.relations) {
    if (rel.type !== 'trade_agreement' || rel.status !== 'active') continue;
    if (!rel.tradeFlows || rel.tradeFlows.length === 0) continue;

    const from = state.countries[rel.fromCountry];
    const to = state.countries[rel.toCountry];
    if (!from || !to) continue;

    // Check if sanctions/blockade disrupt this trade
    if (hasActiveSanctionOrBlockade(state.relations, rel.fromCountry, rel.toCountry)) {
      events.push(makeEvent(state, 'trade_disrupted', 'medium',
        `Trade between ${rel.fromCountry} and ${rel.toCountry} disrupted by sanctions/blockade`,
        [rel.fromCountry, rel.toCountry]));
      continue;
    }

    for (const flow of rel.tradeFlows) {
      const exporter = flow.direction === 'from_to' ? from : to;
      const importer = flow.direction === 'from_to' ? to : from;

      const exportBal = getBalance(exporter, flow.resource);
      const importBal = getBalance(importer, flow.resource);

      // Can only export surplus
      const surplus = exportBal.production - exportBal.consumption;
      const actualFlow = Math.min(flow.amountPerTick, Math.max(0, surplus));

      exportBal.exported += actualFlow;
      importBal.imported += actualFlow;

      exporter.resourceState[flow.resource] = exportBal;
      importer.resourceState[flow.resource] = importBal;
    }
  }

  // ── Step 5: Smuggle routes ──
  for (const rel of state.relations) {
    if (rel.type !== 'smuggle_route' || rel.status !== 'active') continue;
    if (!rel.tradeFlows || rel.tradeFlows.length === 0) continue;

    const from = state.countries[rel.fromCountry];
    const to = state.countries[rel.toCountry];
    if (!from || !to) continue;

    // Detection check
    const detectionChance = rel.smuggleDetectionChance ?? 0.15;
    if (rng() < detectionChance) {
      // Caught!
      rel.status = 'broken';
      from.diplomaticInfluence = Math.max(0, from.diplomaticInfluence - 10);
      events.push(makeEvent(state, 'contraband_discovered', 'high',
        `Contraband route between ${rel.fromCountry} and ${rel.toCountry} discovered!`,
        [rel.fromCountry, rel.toCountry]));
      continue;
    }

    for (const flow of rel.tradeFlows) {
      const exporter = flow.direction === 'from_to' ? from : to;
      const importer = flow.direction === 'from_to' ? to : from;

      const exportBal = getBalance(exporter, flow.resource);
      const importBal = getBalance(importer, flow.resource);

      const surplus = exportBal.production - exportBal.consumption;
      const actualFlow = Math.min(flow.amountPerTick, Math.max(0, surplus));

      exportBal.exported += actualFlow;
      importBal.smuggled += actualFlow;

      exporter.resourceState[flow.resource] = exportBal;
      importer.resourceState[flow.resource] = importBal;
    }
  }

  // ── Step 6: Calculate deficits ──
  for (const [code, country] of Object.entries(state.countries)) {
    for (const r of allResources) {
      const bal = getBalance(country, r);
      const available = bal.production + bal.imported + bal.smuggled - bal.exported;
      bal.deficit = Math.max(0, bal.consumption - available);

      // Consume stockpile
      if (bal.deficit > 0 && bal.stockpile > 0) {
        const stockpileUnits = bal.stockpile * bal.consumption; // months → units
        const consumed = Math.min(stockpileUnits, bal.deficit);
        bal.deficit -= consumed;
        bal.stockpile -= consumed / Math.max(0.1, bal.consumption);

        if (bal.stockpile <= 0) {
          bal.stockpile = 0;
          events.push(makeEvent(state, 'stockpile_depleted', 'high',
            `${code} strategic reserve of ${r} depleted!`, [code]));
        }
      }

      country.resourceState[r] = bal;
    }
  }

  // ── Step 7: Economic effects of deficits ──
  // NOTE: We compute a per-tick penalty but DO NOT permanently accumulate into gdpGrowth.
  // Instead, resourceShockMultiplier captures the ongoing deficit effect (used by economy tick).
  for (const [code, country] of Object.entries(state.countries)) {
    let totalSeverity = 0;

    for (const r of allResources) {
      const bal = getBalance(country, r);
      if (bal.deficit <= 0 || bal.consumption <= 0) continue;

      const severity = clamp(bal.deficit / bal.consumption, 0, 1);
      totalSeverity += severity;

      const impact = DEFICIT_IMPACT[r] ?? DEFAULT_IMPACT;
      // Small per-tick effect (not cumulative — capped by clamp on stability/approval)
      country.stability = clamp(country.stability - severity * impact.stability * 0.3, 0, 100);
      country.approval = clamp(country.approval - severity * impact.approval * 0.3, 0, 100);
    }

    // resourceShockMultiplier captures the cumulative deficit pressure on GDP (used in economy tick)
    country.economy.resourceShockMultiplier = 1 + clamp(totalSeverity * 0.05, 0, 2);

    // Generate supply shock event for severe deficits
    if (totalSeverity > 3) {
      events.push(makeEvent(state, 'supply_shock', 'critical',
        `${code} experiencing severe resource shortages!`, [code]));
    }
  }

  // ── Step 8: Global market prices ──
  const globalSupply: Record<string, number> = {};
  const globalDemand: Record<string, number> = {};
  const prices: Record<string, number> = {};

  for (const r of allResources) {
    let supply = 0;
    let demand = 0;
    for (const country of Object.values(state.countries)) {
      const bal = getBalance(country, r);
      supply += bal.production;
      demand += bal.consumption;
    }
    globalSupply[r] = supply;
    globalDemand[r] = demand;

    const basePrice = BASE_PRICES[r] ?? 100;
    if (supply > 0) {
      prices[r] = clamp(basePrice * (demand / supply), basePrice * 0.5, basePrice * 5);
    } else {
      prices[r] = basePrice * 5; // no supply = max price
    }
  }

  // Price spike events
  for (const r of allResources) {
    const basePrice = BASE_PRICES[r] ?? 100;
    if (prices[r] > basePrice * 2) {
      events.push(makeEvent(state, 'price_spike', 'high',
        `Global ${r} price spiked to $${Math.round(prices[r])}!`,
        []));
    }
  }

  // ── Step 9: Trade balance effects ──
  for (const [code, country] of Object.entries(state.countries)) {
    let tradeRevenue = 0;
    let tradeCost = 0;

    for (const r of allResources) {
      const bal = getBalance(country, r);
      const price = prices[r] ?? 100;
      tradeRevenue += bal.exported * price * 0.001; // scale down
      tradeCost += bal.imported * price * 0.001;
    }

    country.economy.tradeBalance += (tradeRevenue - tradeCost) * 0.01; // gentle effect
  }

  const resourceMarket: ResourceMarket = { prices, globalSupply, globalDemand };
  return { resourceMarket, events };
}

// ── Event helper ──

let eventCounter = 0;

function makeEvent(
  state: GameState,
  type: GameEvent['type'],
  severity: GameEvent['severity'],
  description: string,
  involvedCountries: string[],
): GameEvent {
  eventCounter++;
  return {
    id: `res_${state.session.currentTick}_${eventCounter}`,
    sessionId: state.session.id,
    tick: state.session.currentTick,
    type,
    severity,
    title: description.split('!')[0] || description,
    description,
    involvedCountries,
    data: {},
    createdAt: new Date().toISOString(),
  };
}
