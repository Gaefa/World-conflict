import type { GameState, CountryState, PlayerAction, DiplomaticRelation, ResourceType } from '@conflict-game/shared-types';
import type { RNG } from '@conflict-game/game-logic';
import type { AIState } from './personality';

/** Codes of human-controlled countries in this session. */
function humanPlayerCodes(state: GameState): string[] {
  return state.players
    .filter(p => !p.isAI && p.countryCode)
    .map(p => p.countryCode as string);
}

/** Has this AI already sent a pending proposal of this type to this target? */
function hasPendingProposalTo(state: GameState, fromCode: string, toCode: string, type: string): boolean {
  return state.relations.some(
    r => r.fromCountry === fromCode && r.toCountry === toCode &&
         r.type === type && r.status === 'proposed'
  );
}

export function computeDiplomaticActions(
  state: GameState,
  aiState: AIState,
  country: CountryState,
  currentTick: number,
  diff: number,
  rng: RNG,
): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const p = aiState.personality;
  const code = aiState.countryCode;

  // ── Priority: outreach to human players ───────────────────────
  // Each AI country reaches out to the human player every 8–20 ticks
  const humanCodes = humanPlayerCodes(state);
  for (const humanCode of humanCodes) {
    if (humanCode === code) continue;
    if (aiState.enemies.includes(humanCode)) continue;

    const cooldown = 8 + Math.floor(rng() * 12); // 8–20 ticks between approaches
    if (currentTick - aiState.lastProposalToHumanTick < cooldown) continue;

    // Don't pile on: with 29 AI countries even long per-AI cooldowns flood
    // the human. Skip if they already have 2+ unanswered proposals.
    const pendingToHuman = state.relations.filter(
      r => r.toCountry === humanCode && r.status === 'proposed'
    ).length;
    if (pendingToHuman >= 2) continue;

    // Already have active or pending relation of the same type?
    const hasAlliance = state.relations.some(
      r => r.type === 'alliance' && r.status === 'active' &&
           ((r.fromCountry === code && r.toCountry === humanCode) ||
            (r.fromCountry === humanCode && r.toCountry === code))
    );
    const hasPendingAlliance = hasPendingProposalTo(state, code, humanCode, 'alliance');
    const hasPendingTrade = hasPendingProposalTo(state, code, humanCode, 'trade_agreement');

    let proposal: PlayerAction | null = null;

    switch (p.strategy) {
      case 'diplomatic':
        // Diplomatic AI wants alliances most
        if (!hasAlliance && !hasPendingAlliance && country.diplomaticInfluence >= 5) {
          proposal = { type: 'propose_alliance', targetCountry: humanCode };
        } else if (!hasPendingTrade && country.diplomaticInfluence >= 2) {
          proposal = buildTradeProposal(code, humanCode, country, rng);
        }
        break;

      case 'economic':
        // Economic AI wants trade
        if (!hasPendingTrade && country.diplomaticInfluence >= 2) {
          proposal = buildTradeProposal(code, humanCode, country, rng);
        }
        break;

      case 'defensive':
        // Defensive AI wants non-aggression or trade
        if (!hasPendingTrade && country.diplomaticInfluence >= 2) {
          proposal = buildTradeProposal(code, humanCode, country, rng);
        }
        break;

      case 'aggressive':
      case 'expansionist':
        // Aggressive AI may offer arms deal or demand non-aggression while building up
        if (!hasPendingTrade && country.diplomaticInfluence >= 2 && rng() < 0.4) {
          // Arms deal — sell weapons
          if (country.military.techLevel >= 3) {
            proposal = { type: 'arms_deal', targetCountry: humanCode, amount: 5 };
          } else {
            proposal = buildTradeProposal(code, humanCode, country, rng);
          }
        }
        break;
    }

    if (proposal) {
      actions.push(proposal);
      aiState.lastProposalToHumanTick = currentTick;
      break; // one human outreach per AI action cycle
    }
  }

  // ── Standard AI↔AI diplomacy ─────────────────────────────────
  if (aiState.allies.length < 3 && rng() < p.diplomacy * 0.25 * diff) {
    const candidate = findAllyCandidate(state, aiState, rng);
    if (candidate && !humanCodes.includes(candidate)) { // don't double-propose to human
      if (aiState.allies.length === 0) {
        actions.push({
          type: 'propose_trade', targetCountry: candidate,
          offers: [{ resource: 'oil', amount: 10 }],
          requests: [{ resource: 'electronics', amount: 5 }],
        });
      } else {
        actions.push({ type: 'propose_alliance', targetCountry: candidate });
      }
    }
  }

  // Sanctions against enemies
  if (p.diplomacy > 0.6 && aiState.enemies.length > 0 && rng() < 0.2 * diff) {
    actions.push({ type: 'propose_sanction', targetCountry: aiState.enemies[0] });
  }

  // Accept / reject all pending proposals (from anyone)
  const pending = state.relations.filter(
    r => r.toCountry === code && r.status === 'proposed'
  );
  for (const proposal of pending) {
    const shouldAccept = evaluateProposal(proposal, aiState, state, rng);
    actions.push({
      type: shouldAccept ? 'accept_proposal' : 'reject_proposal',
      relationId: proposal.id,
    });
  }

  return actions;
}

/** Build a trade proposal based on the AI's actual resource surpluses. */
function buildTradeProposal(
  fromCode: string, toCode: string,
  country: CountryState, rng: RNG,
): PlayerAction {
  const rs = country.resourceState ?? {};
  // Offer resources in surplus (production > consumption)
  const surplusResources = Object.entries(rs)
    .filter(([, b]) => b && b.production > b.consumption * 1.2)
    .map(([r]) => r);

  const offerResource = surplusResources.length > 0
    ? surplusResources[Math.floor(rng() * surplusResources.length)]
    : (['oil', 'gas', 'wheat', 'iron'][Math.floor(rng() * 4)]);

  return {
    type: 'propose_trade',
    targetCountry: toCode,
    offers: [{ resource: offerResource as ResourceType, amount: 5 + Math.floor(rng() * 10) }],
    requests: [],
    duration: 12,
  };
}

function findAllyCandidate(state: GameState, aiState: AIState, rng: RNG): string | null {
  const candidates = Object.entries(state.countries)
    .filter(([code]) =>
      code !== aiState.countryCode &&
      !aiState.allies.includes(code) &&
      !aiState.enemies.includes(code)
    )
    .filter(([, c]) => c.stability > 40 && c.economy.gdp > 200)
    .sort(([, a], [, b]) => b.indexOfPower - a.indexOfPower);

  return candidates.length > 0 ? candidates[Math.floor(rng() * Math.min(5, candidates.length))][0] : null;
}

function evaluateProposal(
  proposal: DiplomaticRelation,
  aiState: AIState,
  state: GameState,
  rng: RNG,
): boolean {
  const p = aiState.personality;
  const other = proposal.fromCountry;

  // Never accept from enemies
  if (aiState.enemies.includes(other)) return false;

  switch (proposal.type) {
    case 'alliance':
      // Accept alliance if diplomatic or if proposer is strong
      return p.diplomacy > 0.4 || (state.countries[other]?.indexOfPower ?? 0) > 40;

    case 'trade_agreement':
      // Usually accept trade
      return p.economy > 0.2 || rng() < 0.7;

    case 'non_aggression':
      // Accept if not aggressive
      return p.aggression < 0.7;

    case 'war':
      // Join war only if aggressive and target is weak
      return p.aggression > 0.6 && p.riskTolerance > 0.5;

    case 'sanction':
      // Support sanctions from allies
      return aiState.allies.includes(other) && p.diplomacy > 0.3;

    default:
      return rng() < 0.5;
  }
}
