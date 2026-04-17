import type {
  PlayerAction,
  ActionResult,
  ActionEffect,
  GameState,
  CountryState,
} from '@conflict-game/shared-types';
import { TECH_TREE, defaultTechBonuses } from '@conflict-game/shared-types';
import { canResearchTech } from '@conflict-game/game-logic';
import { clamp, fail } from './_helpers';

export function processSetTaxRate(country: CountryState, rate: number, action: PlayerAction): ActionResult {
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

export function processAllocateBudget(
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

export function processResearchTechV2(
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

export function processCancelResearch(
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

// ══════════════════════════════════════════════════════════
// ARMS DEALS
// ══════════════════════════════════════════════════════════

export function processArmsDeal(
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

// ══════════════════════════════════════════════════════════
// SANCTION EVASION
// ══════════════════════════════════════════════════════════

export function processSanctionEvasion(
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
