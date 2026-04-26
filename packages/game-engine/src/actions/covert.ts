import type {
  PlayerAction,
  ActionResult,
  ActionEffect,
  GameState,
  CountryState,
  HeldAsset,
} from '@conflict-game/shared-types';
import type { RNG } from '@conflict-game/game-logic';
import { addEvent, clamp, fail, makeDipRelation } from './_helpers';

export function processProxyWar(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'proxy_war' },
  rng: RNG,
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
  const exposed = rng() < 0.3;
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

export function processInciteRebellion(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'incite_rebellion' },
  rng: RNG,
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
  const success = rng() < baseChance + 0.2;

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

export function processSabotage(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'sabotage' },
  rng: RNG,
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const cost = 5;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);

  from.economy.budget -= cost;

  const techAdvantage = Math.max(0, from.techLevel - target.techLevel);
  const successChance = 0.4 + techAdvantage * 0.1;
  const success = rng() < successChance;

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

export function processCyberAttack(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'cyber_attack' },
  rng: RNG,
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const cost = 3;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B budget`);
  if (from.techLevel < 3) return fail(action, 'Need tech level 3+ for cyber operations');

  from.economy.budget -= cost;

  const cyberPower = from.techLevel * (1 + rng() * 0.5);
  const cyberDefense = target.techLevel * (1 + rng() * 0.3);
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
    const detected = rng() < 0.2;
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

export function processCoupAttempt(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'coup_attempt' },
  rng: RNG,
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
  const success = rng() < baseChance;

  if (success) {
    target.stability = clamp(target.stability - 40, 0, 100);
    target.approval = 30 + rng() * 20; // new government starts ~40% approval
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

export function processPropaganda(
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

export function processFalseFlag(
  state: GameState, from: CountryState, fromCode: string,
  action: PlayerAction & { type: 'false_flag' },
  rng: RNG,
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
  const believed = rng() < believability;

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

// ── v0.5: Abduction & asset operations ──────────────────────────────────────

export function processAbductAsset(
  state: GameState,
  from: CountryState,
  fromCode: string,
  action: PlayerAction & { type: 'abduct_asset' },
  rng: RNG,
): ActionResult {
  const target = state.countries[action.targetCountry];
  if (!target) return fail(action, 'Target country not in game');

  const researched = from.tech?.researchedTechs ?? [];
  const reqTech = action.assetType === 'president' ? 'intel_3' : 'intel_2';
  if (!researched.includes(reqTech))
    return fail(action, `Requires ${reqTech === 'intel_3' ? 'Presidential Security Breach (intel_3)' : 'Deep Cover Assets (intel_2)'}`);

  const cost = action.assetType === 'president' ? 15 : 5;
  if (from.economy.budget < cost) return fail(action, `Need $${cost}B`);
  from.economy.budget -= cost;

  // Success probability: base 40% for diplomat, 25% for general, 15% for scientist, 8% for president
  const baseProb: Record<string, number> = { diplomat: 0.40, scientist: 0.25, general: 0.30, president: 0.08 };
  const targetCI = target.intel?.counterIntel ?? 30;
  const fromCI = from.intel?.counterIntel ?? 30;
  const prob = clamp((baseProb[action.assetType] ?? 0.2) * (1 + (fromCI - targetCI) / 100), 0.05, 0.7);

  if (rng() > prob) {
    // Caught
    from.diplomaticInfluence = clamp(from.diplomaticInfluence - 20, 0, 100);
    addEvent(state, 'diplomatic_incident',
      `Abduction attempt foiled in ${action.targetCountry}`,
      `${fromCode} agents caught attempting to abduct a ${action.assetType} in ${action.targetCountry}. Diplomatic crisis.`,
      'critical', [fromCode, action.targetCountry]);
    return {
      success: false, action,
      message: `Operation compromised — agents caught in ${action.targetCountry}`,
      effects: [
        { description: `Budget -$${cost}B (lost)`, known: true },
        { description: 'Influence -20 (agents caught)', known: true, value: '-20' },
        { description: 'War casus belli generated', known: false },
      ],
    };
  }

  // Success
  if (!from.heldAssets) from.heldAssets = [];
  const asset: HeldAsset = {
    id: `asset-${fromCode}-${Date.now()}`,
    assetType: action.assetType,
    fromCountry: action.targetCountry,
    capturedAtTick: state.session.currentTick,
  };
  from.heldAssets.push(asset);

  if (action.assetType === 'president') {
    target.stability = clamp(target.stability - 30, 0, 100);
    target.approval = clamp(target.approval - 20, 0, 100);
  }

  addEvent(state, 'diplomatic_incident',
    `${action.assetType} abducted from ${action.targetCountry}`,
    `${fromCode} has successfully abducted a ${action.assetType} from ${action.targetCountry}.`,
    'critical', [fromCode, action.targetCountry]);

  return {
    success: true, action,
    message: `${action.assetType} successfully extracted from ${action.targetCountry}`,
    effects: [
      { description: `${action.assetType} held — use for leverage`, known: true },
      { description: action.assetType === 'president' ? 'Target stability -30, approval -20' : 'Target destabilized', known: true },
      { description: 'Can ransom, exchange, or release for goodwill', known: true },
      { description: 'Target may retaliate', known: false },
    ],
  };
}

export function processReleaseAsset(
  state: GameState,
  from: CountryState,
  fromCode: string,
  action: PlayerAction & { type: 'release_asset' },
): ActionResult {
  if (!from.heldAssets) return fail(action, 'No assets held');
  const assetIdx = from.heldAssets.findIndex((a) => a.id === action.assetId);
  if (assetIdx === -1) return fail(action, 'Asset not found');

  const asset = from.heldAssets[assetIdx];
  from.heldAssets.splice(assetIdx, 1);

  const effects: ActionEffect[] = [{ description: `${asset.assetType} released to ${asset.fromCountry}`, known: true }];

  switch (action.terms) {
    case 'ransom':
      from.economy.budget += 5;
      effects.push({ description: 'Ransom received: +$5B', known: true, value: '+$5B' });
      break;
    case 'exchange': {
      // Try to recover a matching held asset from the other country
      const other = state.countries[asset.fromCountry];
      if (other?.heldAssets) {
        const match = other.heldAssets.findIndex((a) => a.fromCountry === fromCode);
        if (match !== -1) {
          other.heldAssets.splice(match, 1);
          effects.push({ description: 'Your held asset returned in exchange', known: true });
        } else {
          effects.push({ description: 'No matching asset to exchange — goodwill bonus instead', known: true });
          from.diplomaticInfluence = clamp(from.diplomaticInfluence + 8, 0, 100);
        }
      }
      break;
    }
    case 'goodwill':
      from.diplomaticInfluence = clamp(from.diplomaticInfluence + 12, 0, 100);
      effects.push({ description: 'Diplomatic influence +12', known: true, value: '+12' });
      break;
  }

  addEvent(state, 'diplomatic_incident',
    `${asset.assetType} released to ${asset.fromCountry}`,
    `${fromCode} has released the ${asset.assetType} to ${asset.fromCountry} (terms: ${action.terms}).`,
    'medium', [fromCode, asset.fromCountry]);

  return { success: true, action, message: `${asset.assetType} released (${action.terms})`, effects };
}
