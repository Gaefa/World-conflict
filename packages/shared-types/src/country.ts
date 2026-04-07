// ── Raw Resources (extracted/harvested) ──

export type RawResource =
  // Energy
  | 'oil' | 'gas' | 'coal'
  // Industrial metals
  | 'iron' | 'copper' | 'aluminum' | 'titanium'
  // Precious metals
  | 'gold' | 'silver' | 'palladium' | 'platinum'
  // Luxury
  | 'diamonds' | 'gemstones'
  // Strategic minerals
  | 'rareEarth' | 'lithium' | 'cobalt'
  // Nuclear
  | 'uranium'
  // Forestry
  | 'timber' | 'rareWood'
  // Agriculture & water
  | 'wheat' | 'rice' | 'fish'
  | 'freshWater';

// ── Processed Resources (require raw inputs + tech level) ──

export type ProcessedResource =
  | 'steel'               // iron + coal
  | 'electronics'         // rareEarth + copper + gold
  | 'semiconductors'      // rareEarth + lithium + electronics
  | 'refinedOil'          // oil → fuel, plastics
  | 'nuclearFuel'         // uranium → enriched fuel
  | 'luxuryGoods'         // diamonds + gold + rareWood
  | 'weaponsComponents'   // steel + electronics + titanium
  | 'pharmaceuticals'     // advanced chemicals + tech
  | 'fertilizer';         // gas + minerals

export type ResourceType = RawResource | ProcessedResource;

export type ResourceCategory =
  | 'energy' | 'industrial_metals' | 'precious' | 'luxury'
  | 'strategic_minerals' | 'nuclear' | 'forestry'
  | 'agriculture' | 'processed';

// ── Processing chains: raw → processed ──

export interface ProcessingChainInput {
  resource: RawResource | ProcessedResource; // e.g. semiconductors needs electronics (processed)
  amount: number;
}

export interface ProcessingChain {
  output: ProcessedResource;
  inputs: ProcessingChainInput[];
  techRequired: number;      // min tech level
  capacityPerTick: number;   // max output/tick at full capacity
}

// ── Per-resource runtime balance (computed each tick) ──

export interface ResourceBalance {
  production: number;    // units/month from capacity
  consumption: number;   // units/month from GDP/pop/tech
  imported: number;      // via trade agreements
  exported: number;      // via trade agreements
  smuggled: number;      // via contraband routes (bypasses sanctions)
  deficit: number;       // max(0, consumption - production - imported - smuggled + exported)
  stockpile: number;     // strategic reserve (months of consumption)
}

// ── Country raw resource capacities (seed data) ──

export interface CountryResources {
  // Energy
  oil: number;           // 0-100 production capacity
  gas: number;
  coal: number;
  // Industrial metals
  iron: number;
  copper: number;
  aluminum: number;
  titanium: number;
  // Precious metals
  gold: number;
  silver: number;
  palladium: number;
  platinum: number;
  // Luxury
  diamonds: number;
  gemstones: number;
  // Strategic minerals
  rareEarth: number;
  lithium: number;
  cobalt: number;
  // Nuclear
  uranium: number;
  // Forestry
  timber: number;
  rareWood: number;
  // Agriculture
  wheat: number;
  rice: number;
  fish: number;
  freshWater: number;
}

// Which processed resources this country can produce
export type ProcessingCapability = ProcessedResource;

export interface CountryEconomy {
  gdp: number;           // billions USD
  gdpGrowth: number;     // annual % growth
  budget: number;         // available budget (billions)
  taxRate: number;        // 0-1
  tradeBalance: number;   // billions
  debtToGdp: number;      // ratio
  inflation: number;      // %
  sanctionResilience: number;  // 0-100
  sanctionEvasion: number;     // 0-100
  resourceShockMultiplier: number; // 1.0 = normal, >1 = suffering deficit shock
}

export interface CountryMilitary {
  army: number;           // personnel count
  navy: number;           // vessel count
  airForce: number;       // aircraft count
  nuclearWeapons: number; // warhead count
  defenseBudget: number;  // billions USD
  techLevel: number;      // 1-10
}

export interface CountryState {
  code: string;           // ISO 3166-1 alpha-2
  economy: CountryEconomy;
  military: CountryMilitary;
  resources: CountryResources;
  processingCapabilities: ProcessingCapability[]; // which processed resources this country can make
  resourceState: Partial<Record<ResourceType, ResourceBalance>>; // computed each tick
  stability: number;      // 0-100
  approval: number;       // 0-100 population approval
  techLevel: number;      // 1-10
  diplomaticInfluence: number; // 0-100
  indexOfPower: number;   // calculated, 0-100
  intel?: import('./intelligence.js').IntelligenceState; // v0.3: fog of war
  tech?: import('./technology.js').TechnologyState;      // v0.4: tech tree
}

export interface CountryData {
  code: string;
  name: string;
  capital: string;
  region: string;
  subregion: string;
  latitude: number;
  longitude: number;
  area: number;           // km²
  population: number;
  flag: string;           // emoji flag
  startingState: CountryState;
}
