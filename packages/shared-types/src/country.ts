export interface CountryEconomy {
  gdp: number;           // billions USD
  gdpGrowth: number;     // annual % growth
  budget: number;         // available budget (billions)
  taxRate: number;        // 0-1
  tradeBalance: number;   // billions
  debtToGdp: number;      // ratio
  inflation: number;      // %
  sanctionResilience: number;  // 0-100, how well economy withstands sanctions
  sanctionEvasion: number;     // 0-100, shadow fleet / crypto / parallel import effectiveness
}

export interface CountryMilitary {
  army: number;           // personnel count
  navy: number;           // vessel count
  airForce: number;       // aircraft count
  nuclearWeapons: number; // warhead count
  defenseBudget: number;  // billions USD
  techLevel: number;      // 1-10
}

export interface CountryResources {
  oil: number;            // 0-100 production capacity
  gas: number;
  metals: number;
  rareEarth: number;
  food: number;
  water: number;
}

export interface CountryState {
  code: string;           // ISO 3166-1 alpha-2
  economy: CountryEconomy;
  military: CountryMilitary;
  resources: CountryResources;
  stability: number;      // 0-100
  approval: number;       // 0-100 population approval
  techLevel: number;      // 1-10
  diplomaticInfluence: number; // 0-100
  indexOfPower: number;   // calculated, 0-100
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
