import type {
  PlayerAction,
  ActionResult,
  ActionEffect,
  GameState,
  CountryState,
} from '@conflict-game/shared-types';
import { SPY_OP_CONFIG } from '@conflict-game/shared-types';
import { fail } from './_helpers';

export function processLaunchSpyOp(
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

export function processBoostCounterIntel(
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

export function processLaunchDisinfo(
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

export function processSetIntelBudget(
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
