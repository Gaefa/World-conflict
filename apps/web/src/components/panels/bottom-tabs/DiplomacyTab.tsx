'use client';

import { useState } from 'react';
import type { PlayerAction, ResourceType } from '@conflict-game/shared-types';
import { RelationsPanel } from '../RelationsPanel';
import { useLocaleStore } from '@/stores/localeStore';
import { StatCard, Bar, EffectRow, ActionBtn, getResourceLabel, type TabProps } from './_shared';

export function DiplomacyTab({ country, canAct, onAction, targetCountryCode, playerCountryCode, relations, currentTick }: TabProps) {
  const { t } = useLocaleStore();
  const [showTrade, setShowTrade] = useState(false);
  const [tradeOffers, setTradeOffers] = useState<Record<string, number>>({});
  const [tradeRequests, setTradeRequests] = useState<Record<string, number>>({});

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;

  // War / peace state with target
  const isAtWarWithTarget = hasTarget && relations?.some(
    r => r.type === 'war' && r.status === 'active' &&
      ((r.fromCountry === playerCountryCode && r.toCountry === targetCountryCode) ||
       (r.fromCountry === targetCountryCode && r.toCountry === playerCountryCode))
  );

  // Incoming proposals (to this player, status=proposed)
  const incomingProposals = relations?.filter(
    r => r.status === 'proposed' && r.toCountry === playerCountryCode
  ) ?? [];

  const sendTrade = () => {
    if (!hasTarget) return;
    const offers = Object.entries(tradeOffers)
      .filter(([, amt]) => amt > 0)
      .map(([resource, amount]) => ({ resource: resource as ResourceType, amount }));
    const requests = Object.entries(tradeRequests)
      .filter(([, amt]) => amt > 0)
      .map(([resource, amount]) => ({ resource: resource as ResourceType, amount }));
    if (offers.length === 0 && requests.length === 0) return;
    act({ type: 'propose_trade', targetCountry: targetCountryCode!, offers, requests, duration: 12 });
    setTradeOffers({});
    setTradeRequests({});
    setShowTrade(false);
  };

  // Get player's surpluses and deficits for trade hints
  const rs = country.resourceState ?? {};

  // Tradeable resources with localized labels
  const tradeableResources: { resource: ResourceType; label: string }[] = [
    { resource: 'oil', label: getResourceLabel(t, 'oil') }, { resource: 'gas', label: getResourceLabel(t, 'gas') },
    { resource: 'coal', label: getResourceLabel(t, 'coal') }, { resource: 'iron', label: getResourceLabel(t, 'iron') },
    { resource: 'copper', label: getResourceLabel(t, 'copper') }, { resource: 'aluminum', label: getResourceLabel(t, 'aluminum') },
    { resource: 'titanium', label: getResourceLabel(t, 'titanium') }, { resource: 'gold', label: getResourceLabel(t, 'gold') },
    { resource: 'rareEarth', label: getResourceLabel(t, 'rareEarth') }, { resource: 'lithium', label: getResourceLabel(t, 'lithium') },
    { resource: 'uranium', label: getResourceLabel(t, 'uranium') }, { resource: 'wheat', label: getResourceLabel(t, 'wheat') },
    { resource: 'rice', label: getResourceLabel(t, 'rice') }, { resource: 'timber', label: getResourceLabel(t, 'timber') },
    { resource: 'steel', label: getResourceLabel(t, 'steel') }, { resource: 'electronics', label: getResourceLabel(t, 'electronics') },
    { resource: 'semiconductors', label: getResourceLabel(t, 'semiconductors') }, { resource: 'refinedOil', label: getResourceLabel(t, 'refinedOil') },
    { resource: 'weaponsComponents', label: getResourceLabel(t, 'weaponsComponents') }, { resource: 'pharmaceuticals', label: getResourceLabel(t, 'pharmaceuticals') },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label={t.diplo_stat_influence} value={country.diplomaticInfluence.toFixed(0)} sub={t.diplo_stat_influence_sub} />
        <StatCard label={t.diplo_stat_power} value={country.indexOfPower.toFixed(1)} sub={t.diplo_stat_power_sub} />
        <StatCard label={t.diplo_stat_relations} value="—" sub={t.diplo_stat_relations_sub} />
      </div>

      {!showTrade ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.diplo_status}</h4>
            <Bar label={t.diplo_bar_influence} value={country.diplomaticInfluence} max={100} color="bg-accent-blue" />
            <EffectRow label={t.diplo_target_label} value={hasTarget ? targetCountryCode! : t.diplo_click_country} />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
              {t.diplo_actions_label} {hasTarget ? `\u2192 ${targetCountryCode}` : ''}
            </h4>
            <ActionBtn
              label={t.diplo_propose_alliance}
              cost={t.diplo_alliance_cost}
              effect={t.diplo_alliance_eff}
              disabled={!canAct || !hasTarget || country.diplomaticInfluence < 5}
              onClick={() => act({ type: 'propose_alliance', targetCountry: targetCountryCode! })}
            />
            <ActionBtn
              label={t.diplo_declare_war}
              cost={t.diplo_war_cost}
              effect={t.diplo_war_eff}
              disabled={!canAct || !hasTarget}
              onClick={() => act({ type: 'declare_war', targetCountry: targetCountryCode! })}
            />
            <ActionBtn
              label={t.diplo_sanctions}
              cost={t.diplo_sanction_cost}
              effect={t.diplo_sanction_eff}
              disabled={!canAct || !hasTarget || country.diplomaticInfluence < 3}
              onClick={() => act({ type: 'propose_sanction', targetCountry: targetCountryCode! })}
            />
            <ActionBtn
              label={t.diplo_trade}
              cost={t.diplo_trade_cost}
              effect={t.diplo_trade_eff}
              disabled={!canAct || !hasTarget || country.diplomaticInfluence < 2}
              onClick={() => setShowTrade(true)}
            />
            {isAtWarWithTarget && (
              <ActionBtn
                label={t.diplo_propose_peace}
                cost={t.diplo_peace_cost}
                effect={t.diplo_peace_eff}
                disabled={!canAct}
                onClick={() => act({ type: 'propose_peace', targetCountry: targetCountryCode! })}
              />
            )}
          </div>
        </div>
      ) : (
        /* ── Trade Panel (Civ-style) ── */
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase text-text-secondary">
              {t.diplo_trade_with} {targetCountryCode}
            </h4>
            <button onClick={() => setShowTrade(false)} className="text-text-muted hover:text-text-primary text-xs">
              {t.diplo_cancel}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* YOU OFFER */}
            <div>
              <h5 className="text-xs font-bold text-accent-green mb-2">{t.diplo_you_offer}</h5>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {tradeableResources.map(({ resource, label }) => {
                  const bal = rs[resource];
                  const surplus = bal ? bal.production - bal.consumption - (bal.exported ?? 0) : 0;
                  return (
                    <div key={resource} className="flex items-center gap-1 bg-bg-card rounded px-2 py-0.5">
                      <span className="text-text-secondary text-xs flex-1 truncate">{label}</span>
                      {surplus > 0
                        ? <span className="text-accent-green text-[10px] font-mono shrink-0">+{surplus.toFixed(0)}</span>
                        : <span className="text-text-muted text-[10px] shrink-0">—</span>
                      }
                      <input
                        type="number" min={0} step={1}
                        value={tradeOffers[resource] ?? 0}
                        onChange={e => setTradeOffers(prev => ({ ...prev, [resource]: Math.max(0, Number(e.target.value)) }))}
                        className="w-12 bg-bg-primary border border-border-default rounded px-1 py-0.5 text-xs text-text-primary font-mono text-right shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {/* YOU REQUEST */}
            <div>
              <h5 className="text-xs font-bold text-severity-high mb-2">{t.diplo_you_request}</h5>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {tradeableResources.map(({ resource, label }) => {
                  const bal = rs[resource];
                  const deficit = bal ? bal.deficit : 0;
                  return (
                    <div key={resource} className="flex items-center gap-1 bg-bg-card rounded px-2 py-0.5">
                      <span className="text-text-secondary text-xs flex-1 truncate">{label}</span>
                      {deficit > 0
                        ? <span className="text-severity-high text-[10px] font-mono shrink-0">-{deficit.toFixed(0)}</span>
                        : <span className="text-text-muted text-[10px] shrink-0">—</span>
                      }
                      <input
                        type="number" min={0} step={1}
                        value={tradeRequests[resource] ?? 0}
                        onChange={e => setTradeRequests(prev => ({ ...prev, [resource]: Math.max(0, Number(e.target.value)) }))}
                        className="w-12 bg-bg-primary border border-border-default rounded px-1 py-0.5 text-xs text-text-primary font-mono text-right shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <button
            onClick={sendTrade}
            disabled={Object.values(tradeOffers).every(v => !v) && Object.values(tradeRequests).every(v => !v)}
            className="mt-3 w-full bg-accent-red hover:bg-accent-red/80 disabled:bg-bg-card disabled:opacity-50 text-text-primary text-sm font-bold py-2 rounded transition-colors"
          >
            {t.diplo_send_trade}
          </button>
        </div>
      )}

      {/* Incoming proposals — accept / reject */}
      {incomingProposals.length > 0 && (
        <div className="mt-4 border-t border-border-default pt-3">
          <h4 className="text-xs font-bold uppercase text-accent-amber mb-2">
            ⚡ {t.diplo_incoming_proposals}
          </h4>
          <div className="space-y-1.5">
            {incomingProposals.map(r => (
              <div key={r.id} className="flex items-center gap-2 bg-bg-card border border-accent-amber/30 rounded px-2 py-1.5">
                <span className="text-text-secondary text-xs font-bold uppercase flex-1">
                  {r.fromCountry} → {({ alliance: t.rel_alliance, war: t.rel_war, trade_agreement: t.rel_trade, sanction: t.rel_sanction } as Record<string, string>)[r.type] ?? r.type}
                </span>
                <button
                  disabled={!canAct}
                  onClick={() => act({ type: 'accept_proposal', relationId: r.id })}
                  className="px-2 py-0.5 text-xs bg-accent-green/20 text-accent-green border border-accent-green/40 rounded hover:bg-accent-green/30 disabled:opacity-40"
                >
                  {t.diplo_accept}
                </button>
                <button
                  disabled={!canAct}
                  onClick={() => act({ type: 'reject_proposal', relationId: r.id })}
                  className="px-2 py-0.5 text-xs bg-severity-high/20 text-severity-high border border-severity-high/40 rounded hover:bg-severity-high/30 disabled:opacity-40"
                >
                  {t.diplo_reject}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relations overview */}
      {relations && relations.length > 0 && (
        <div className="mt-4 border-t border-border-default pt-3">
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.diplo_active_relations_header}</h4>
          <RelationsPanel
            relations={relations}
            playerCountryCode={playerCountryCode ?? null}
            currentTick={currentTick ?? 0}
          />
        </div>
      )}
    </div>
  );
}
