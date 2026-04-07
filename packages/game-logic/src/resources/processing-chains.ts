import type { ProcessingChain } from '@conflict-game/shared-types';

/** Global registry of processing recipes: raw inputs → processed output */
export const PROCESSING_CHAINS: ProcessingChain[] = [
  {
    output: 'steel',
    inputs: [
      { resource: 'iron', amount: 3 },
      { resource: 'coal', amount: 1 },
    ],
    techRequired: 3,
    capacityPerTick: 50,
  },
  {
    output: 'electronics',
    inputs: [
      { resource: 'rareEarth', amount: 2 },
      { resource: 'copper', amount: 2 },
      { resource: 'gold', amount: 1 },
    ],
    techRequired: 5,
    capacityPerTick: 40,
  },
  {
    output: 'semiconductors',
    inputs: [
      { resource: 'rareEarth', amount: 2 },
      { resource: 'lithium', amount: 1 },
      { resource: 'electronics', amount: 2 }, // processed input!
    ],
    techRequired: 8,
    capacityPerTick: 20,
  },
  {
    output: 'refinedOil',
    inputs: [
      { resource: 'oil', amount: 3 },
    ],
    techRequired: 3,
    capacityPerTick: 60,
  },
  {
    output: 'nuclearFuel',
    inputs: [
      { resource: 'uranium', amount: 2 },
    ],
    techRequired: 7,
    capacityPerTick: 10,
  },
  {
    output: 'luxuryGoods',
    inputs: [
      { resource: 'diamonds', amount: 1 },
      { resource: 'gold', amount: 1 },
      { resource: 'rareWood', amount: 1 },
    ],
    techRequired: 4,
    capacityPerTick: 15,
  },
  {
    output: 'weaponsComponents',
    inputs: [
      { resource: 'steel', amount: 3 }, // processed input!
      { resource: 'electronics', amount: 2 }, // processed input!
      { resource: 'titanium', amount: 1 },
    ],
    techRequired: 6,
    capacityPerTick: 25,
  },
  {
    output: 'pharmaceuticals',
    inputs: [
      { resource: 'rareEarth', amount: 1 },
      { resource: 'freshWater', amount: 1 },
    ],
    techRequired: 6,
    capacityPerTick: 30,
  },
  {
    output: 'fertilizer',
    inputs: [
      { resource: 'gas', amount: 2 },
      { resource: 'iron', amount: 1 },
    ],
    techRequired: 3,
    capacityPerTick: 40,
  },
];
