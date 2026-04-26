'use client';

import { useState } from 'react';
import type { CountryState, PlayerAction } from '@conflict-game/shared-types';
import { useLocaleStore } from '@/stores/localeStore';
import type { Translations } from '@/lib/i18n/types';
import { StatCard, Bar, ActionBtn, type TabProps } from './_shared';

// Intel constants inlined to avoid Turbopack .js extension resolution issues with shared-types
type SpyOpKey = 'humint' | 'sigint' | 'satellite' | 'cyber_espionage' | 'diplomatic_probe';
type IntelLevelKey = 'none' | 'low' | 'medium' | 'high' | 'full';

const SPY_OP_CONFIG_UI: Record<SpyOpKey, { cost: number; baseDuration: number; detectionRisk: number; reveals: string; techRequired: number; intelGain: number }> = {
  humint:           { cost: 8,  baseDuration: 6, detectionRisk: 0.12, reveals: 'military',  techRequired: 1, intelGain: 5 },
  sigint:           { cost: 12, baseDuration: 4, detectionRisk: 0.08, reveals: 'economy',   techRequired: 5, intelGain: 8 },
  satellite:        { cost: 15, baseDuration: 3, detectionRisk: 0.05, reveals: 'resources', techRequired: 6, intelGain: 6 },
  cyber_espionage:  { cost: 10, baseDuration: 5, detectionRisk: 0.15, reveals: 'stability', techRequired: 7, intelGain: 10 },
  diplomatic_probe: { cost: 3,  baseDuration: 2, detectionRisk: 0.03, reveals: 'diplomacy', techRequired: 1, intelGain: 3 },
};

const INTEL_THRESHOLDS_UI: Record<IntelLevelKey, number> = { none: 0, low: 25, medium: 60, high: 120, full: 200 };

const INTEL_LEVEL_COLORS: Record<IntelLevelKey, string> = {
  none: 'text-text-muted',
  low: 'text-severity-low',
  medium: 'text-accent-amber',
  high: 'text-accent-green',
  full: 'text-accent-blue',
};

function getSpyOpLabels(t: Translations): Record<SpyOpKey, string> {
  return {
    humint: t.intel_op_humint,
    sigint: t.intel_op_sigint,
    satellite: t.intel_op_satellite,
    cyber_espionage: t.intel_op_cyber,
    diplomatic_probe: t.intel_op_probe,
  };
}

function getRevealsLabel(t: Translations, reveals: string): string {
  const map: Record<string, string> = {
    military: t.intel_reveals_military,
    economy: t.intel_reveals_economy,
    resources: t.intel_reveals_resources,
    stability: t.intel_reveals_stability,
    diplomacy: t.intel_reveals_diplomacy,
  };
  return map[reveals] ?? reveals;
}

export function IntelligenceTab({ country, canAct, onAction, targetCountryCode, playerCountryCode, hasSanctions }: TabProps) {
  const { t } = useLocaleStore();
  const [intelSub, setIntelSub] = useState<'overview' | 'dossiers' | 'ops' | 'covert' | 'assets'>('overview');
  const hasTarget = targetCountryCode && targetCountryCode !== playerCountryCode;
  const intel = country.intel;

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const heldCount = country.heldAssets?.length ?? 0;

  const subTabs = [
    { key: 'overview' as const, label: t.intel_sub_overview },
    { key: 'dossiers' as const, label: t.intel_sub_dossiers },
    { key: 'ops' as const, label: t.intel_sub_ops },
    { key: 'covert' as const, label: t.intel_sub_covert },
    { key: 'assets' as const, label: `${t.intel_sub_assets}${heldCount > 0 ? ` (${heldCount})` : ''}` },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-3 border-b border-border-default pb-2">
        {subTabs.map(st => (
          <button key={st.key} onClick={() => setIntelSub(st.key)}
            className={`text-xs px-2 py-1 rounded ${intelSub === st.key ? 'bg-accent-red/20 text-accent-red font-bold' : 'text-text-muted hover:text-text-primary'}`}>
            {st.label}
          </button>
        ))}
      </div>

      {intelSub === 'overview' && <IntelOverviewSub country={country} intel={intel} canAct={canAct} act={act} />}
      {intelSub === 'dossiers' && <IntelDossiersSub country={country} intel={intel} />}
      {intelSub === 'ops' && <IntelOpsSub country={country} intel={intel} canAct={canAct} act={act} hasTarget={!!hasTarget} targetCountryCode={targetCountryCode} />}
      {intelSub === 'covert' && <IntelCovertSub country={country} canAct={canAct} act={act} hasTarget={!!hasTarget} targetCountryCode={targetCountryCode} hasSanctions={hasSanctions} />}
      {intelSub === 'assets' && <IntelAssetsSub country={country} canAct={canAct} act={act} />}
    </div>
  );
}

function IntelOverviewSub({ country, intel, canAct, act }: { country: CountryState; intel: CountryState['intel']; canAct: boolean; act: (a: PlayerAction) => void }) {
  const { t } = useLocaleStore();
  const counterIntel = intel?.counterIntel ?? 0;
  const intelBudget = intel?.intelBudget ?? 0;
  const activeOpsCount = intel ? Object.values(intel.dossiers).reduce((n, d) => n + d.activeOps.length, 0) : 0;
  const disinfoCount = intel?.disinfo.length ?? 0;
  const dossierCount = intel ? Object.keys(intel.dossiers).length : 0;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard label={t.intel_stat_counter} value={counterIntel.toFixed(0)} sub={counterIntel > 60 ? t.intel_counter_strong : counterIntel > 30 ? t.intel_counter_moderate : t.intel_counter_weak} />
        <StatCard label={t.intel_stat_budget} value={`$${intelBudget.toFixed(0)}B/mo`} sub={t.intel_stat_budget_sub} />
        <StatCard label={t.intel_stat_active_ops} value={String(activeOpsCount)} sub={`${dossierCount} ${t.intel_targets_suffix}`} />
        <StatCard label={t.intel_stat_disinfo} value={String(disinfoCount)} sub={t.intel_stat_disinfo_sub} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_section_defense}</h4>
          <Bar label={t.intel_bar_counter} value={counterIntel} max={100} color="bg-accent-blue" />
          <ActionBtn label={t.intel_boost_5} cost="$5B" effect={t.intel_boost_5_eff}
            disabled={!canAct || country.economy.budget < 5}
            onClick={() => act({ type: 'boost_counter_intel', amount: 5 })} />
          <ActionBtn label={t.intel_boost_15} cost="$15B" effect={t.intel_boost_15_eff}
            disabled={!canAct || country.economy.budget < 15}
            onClick={() => act({ type: 'boost_counter_intel', amount: 15 })} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_budget_header}</h4>
          <div className="flex gap-1 mb-2">
            {[0, 2, 5, 10, 20].map(b => (
              <button key={b} onClick={() => act({ type: 'set_intel_budget', budget: b })}
                disabled={!canAct}
                className={`flex-1 text-xs py-1 rounded border transition-colors ${
                  intelBudget === b ? 'border-accent-red bg-accent-red/20 text-accent-red' : 'border-border-default text-text-muted hover:text-text-primary'
                } ${!canAct ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                ${b}B
              </button>
            ))}
          </div>
          <p className="text-text-muted text-xs">{t.intel_budget_note}</p>
        </div>
      </div>
    </div>
  );
}

function IntelDossiersSub({ country, intel }: { country: CountryState; intel: CountryState['intel'] }) {
  const { t } = useLocaleStore();
  const dossiers = intel?.dossiers ?? {};
  const entries = Object.entries(dossiers);
  const spyOpLabels = getSpyOpLabels(t);

  const revealsCategoryLabels: Record<string, string> = {
    economy: t.intel_reveals_economy,
    military: t.intel_reveals_military,
    resources: t.intel_reveals_resources,
    stability: t.intel_reveals_stability,
    diplomacy: t.intel_reveals_diplomacy,
  };

  if (entries.length === 0) {
    return <p className="text-text-muted text-sm">{t.intel_no_dossiers}</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([code, dossier]) => {
        const levelColor = INTEL_LEVEL_COLORS[dossier.level as IntelLevelKey];
        const nextThreshold = dossier.level === 'full' ? null
          : dossier.level === 'high' ? INTEL_THRESHOLDS_UI.full
          : dossier.level === 'medium' ? INTEL_THRESHOLDS_UI.high
          : dossier.level === 'low' ? INTEL_THRESHOLDS_UI.medium
          : INTEL_THRESHOLDS_UI.low;
        const progress = nextThreshold ? (dossier.intelPoints / nextThreshold) * 100 : 100;
        const revealed = dossier.revealed;

        return (
          <div key={code} className="bg-bg-card border border-border-default rounded p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-text-primary text-sm font-bold">{code}</span>
              <span className={`text-xs font-bold uppercase ${levelColor}`}>
                {dossier.level} ({dossier.intelPoints} {t.intel_dossier_pts_suffix})
              </span>
            </div>
            <div className="h-1 bg-bg-secondary rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-accent-blue rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['economy', 'military', 'resources', 'stability', 'diplomacy'] as const).map(cat => (
                <span key={cat} className={`text-xs px-1.5 py-0.5 rounded ${
                  revealed[cat] ? 'bg-accent-green/20 text-accent-green' : 'bg-bg-secondary text-text-muted'
                }`}>
                  {revealed[cat] ? '\u2713' : '?'} {revealsCategoryLabels[cat] ?? cat}
                </span>
              ))}
            </div>
            {dossier.activeOps.length > 0 && (
              <div className="mt-1.5 text-xs text-text-muted">
                {t.intel_active_ops_label} {dossier.activeOps.map(op => spyOpLabels[op.type as SpyOpKey]).join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IntelOpsSub({ country, intel, canAct, act, hasTarget, targetCountryCode }: {
  country: CountryState; intel: CountryState['intel']; canAct: boolean; act: (a: PlayerAction) => void; hasTarget: boolean; targetCountryCode?: string | null;
}) {
  const { t } = useLocaleStore();

  const spyOps: { key: SpyOpKey; label: string }[] = [
    { key: 'humint', label: t.intel_op_humint },
    { key: 'sigint', label: t.intel_op_sigint },
    { key: 'satellite', label: t.intel_op_satellite },
    { key: 'cyber_espionage', label: t.intel_op_cyber },
    { key: 'diplomatic_probe', label: t.intel_op_probe },
  ];

  const categoryLabels: Record<string, string> = {
    economy: t.intel_category_economy,
    military: t.intel_category_military,
    stability: t.intel_category_stability,
  };

  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
        {t.intel_launch_spy_op} {hasTarget ? <span className="text-accent-red">→ {targetCountryCode}</span> : <span className="text-text-muted">{t.intel_select_target_hint}</span>}
      </h4>
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {spyOps.map(({ key, label }) => {
          const cfg = SPY_OP_CONFIG_UI[key];
          const techOk = (country.techLevel ?? 1) >= cfg.techRequired;
          const budgetOk = country.economy.budget >= cfg.cost;
          const effectStr = t.intel_op_effect_fmt
            .replace('{duration}', String(cfg.baseDuration))
            .replace('{reveals}', getRevealsLabel(t, cfg.reveals))
            .replace('{risk}', (cfg.detectionRisk * 100).toFixed(0));
          return (
            <ActionBtn key={key} label={label}
              cost={`$${cfg.cost}B${cfg.techRequired > 1 ? `, Tech ${cfg.techRequired}+` : ''}`}
              effect={effectStr}
              disabled={!canAct || !hasTarget || !techOk || !budgetOk}
              onClick={() => act({ type: 'launch_spy_op', targetCountry: targetCountryCode!, opType: key as any })} />
          );
        })}
      </div>

      <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_disinfo_header}</h4>
      <p className="text-text-muted text-xs mb-2">{t.intel_disinfo_desc}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {(['economy', 'military', 'stability'] as const).map(cat => {
          const existing = intel?.disinfo.find(d => d.category === cat);
          return (
            <div key={cat} className="bg-bg-card border border-border-default rounded p-2">
              <div className="text-xs font-bold text-text-secondary uppercase mb-1">{categoryLabels[cat] ?? cat}</div>
              {existing ? (
                <div className="text-xs text-accent-amber">
                  {t.intel_disinfo_active_fmt.replace('{mult}', existing.multiplier.toFixed(1)).replace('{dur}', String(existing.duration))}
                </div>
              ) : (
                <div className="flex gap-1">
                  <button disabled={!canAct} onClick={() => act({ type: 'launch_disinfo', category: cat, multiplier: 1.5, duration: 6 })}
                    className={`text-xs px-1 py-0.5 rounded border border-border-default ${!canAct ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-hover cursor-pointer'} text-accent-green`}>
                    +50%
                  </button>
                  <button disabled={!canAct} onClick={() => act({ type: 'launch_disinfo', category: cat, multiplier: 0.6, duration: 6 })}
                    className={`text-xs px-1 py-0.5 rounded border border-border-default ${!canAct ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-hover cursor-pointer'} text-severity-high`}>
                    -40%
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntelAssetsSub({ country, canAct, act }: {
  country: CountryState; canAct: boolean; act: (a: PlayerAction) => void;
}) {
  const { t } = useLocaleStore();
  const held = country.heldAssets ?? [];

  const assetTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      diplomat: t.intel_asset_type_diplomat,
      scientist: t.intel_asset_type_scientist,
      general: t.intel_asset_type_general,
      president: t.intel_asset_type_president,
    };
    return map[type] ?? type;
  };

  if (held.length === 0) {
    return (
      <div className="text-text-muted text-sm py-4 text-center">
        {t.intel_no_held_assets}
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_held_assets_header}</h4>
      <div className="space-y-2">
        {held.map(asset => (
          <div key={asset.id} className="bg-bg-card border border-severity-high/30 rounded p-2.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-text-primary text-sm font-bold">{assetTypeLabel(asset.assetType)}</span>
                <span className="text-text-muted text-xs ml-2">← {asset.fromCountry}</span>
              </div>
              <span className="text-text-muted text-xs">{t.intel_captured_tick_fmt.replace('{tick}', String(asset.capturedAtTick))}</span>
            </div>
            <div className="flex gap-1.5">
              <button
                disabled={!canAct}
                onClick={() => act({ type: 'release_asset', assetId: asset.id, terms: 'ransom' })}
                className="flex-1 text-xs py-1 rounded border border-accent-amber/50 text-accent-amber bg-accent-amber/10 hover:bg-accent-amber/20 disabled:opacity-40 transition-colors"
              >
                {t.intel_release_ransom}
              </button>
              <button
                disabled={!canAct}
                onClick={() => act({ type: 'release_asset', assetId: asset.id, terms: 'exchange' })}
                className="flex-1 text-xs py-1 rounded border border-accent-blue/50 text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 disabled:opacity-40 transition-colors"
              >
                {t.intel_release_exchange}
              </button>
              <button
                disabled={!canAct}
                onClick={() => act({ type: 'release_asset', assetId: asset.id, terms: 'goodwill' })}
                className="flex-1 text-xs py-1 rounded border border-accent-green/50 text-accent-green bg-accent-green/10 hover:bg-accent-green/20 disabled:opacity-40 transition-colors"
              >
                {t.intel_release_goodwill}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntelCovertSub({ country, canAct, act, hasTarget, targetCountryCode, hasSanctions }: {
  country: CountryState; canAct: boolean; act: (a: PlayerAction) => void; hasTarget: boolean; targetCountryCode?: string | null; hasSanctions?: boolean;
}) {
  const { t } = useLocaleStore();
  const [smuggleRes, setSmuggleRes] = useState<import('@conflict-game/shared-types').ResourceType>('oil');
  const [smuggleMethod, setSmuggleMethod] = useState<'land_border' | 'sea_route' | 'intermediary_country' | 'diplomatic_pouch'>('sea_route');
  const smuggleResources: import('@conflict-game/shared-types').ResourceType[] = ['oil','gas','coal','iron','rareEarth','wheat','steel','electronics'];
  const smuggleMethods: { key: 'land_border' | 'sea_route' | 'intermediary_country' | 'diplomatic_pouch'; label: string; risk: string }[] = [
    { key: 'land_border',          label: t.intel_smuggle_land,         risk: '15%' },
    { key: 'sea_route',            label: t.intel_smuggle_sea,          risk: '25%' },
    { key: 'intermediary_country', label: t.intel_smuggle_intermediary, risk: '10%' },
    { key: 'diplomatic_pouch',     label: t.intel_smuggle_pouch,        risk: '5%' },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">
            {t.intel_covert_ops_label} {hasTarget ? `→ ${targetCountryCode}` : ''}
          </h4>
          <ActionBtn label={t.intel_sabotage_energy} cost="$5B" effect={t.intel_sabotage_energy_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 5}
            onClick={() => act({ type: 'sabotage', targetCountry: targetCountryCode!, target: 'energy' })} />
          <ActionBtn label={t.intel_sabotage_military} cost="$5B" effect={t.intel_sabotage_military_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 5}
            onClick={() => act({ type: 'sabotage', targetCountry: targetCountryCode!, target: 'military' })} />
          <ActionBtn label={t.intel_cyber_attack} cost={t.intel_cyber_attack_cost} effect={t.intel_cyber_attack_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 3 || country.techLevel < 3}
            onClick={() => act({ type: 'cyber_attack', targetCountry: targetCountryCode!, target: 'financial' })} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_destabilization}</h4>
          <ActionBtn label={t.intel_incite} cost={t.intel_incite_cost} effect={t.intel_incite_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 8 || country.diplomaticInfluence < 3}
            onClick={() => act({ type: 'incite_rebellion', targetCountry: targetCountryCode! })} />
          <ActionBtn label={t.intel_propaganda} cost={t.intel_propaganda_cost} effect={t.intel_propaganda_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 3}
            onClick={() => act({ type: 'propaganda', targetCountry: targetCountryCode!, narrative: 'anti_government' })} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase text-text-secondary mb-2">{t.intel_black_ops}</h4>
          <ActionBtn label={t.intel_proxy_war} cost={t.intel_proxy_war_cost} effect={t.intel_proxy_war_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 10 || country.diplomaticInfluence < 5}
            onClick={() => act({ type: 'proxy_war', targetCountry: targetCountryCode!, funding: 10 })} />
          <ActionBtn label={t.intel_stage_coup} cost={t.intel_stage_coup_cost} effect={t.intel_stage_coup_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 15 || country.diplomaticInfluence < 10}
            onClick={() => act({ type: 'coup_attempt', targetCountry: targetCountryCode! })} />
          <ActionBtn label={t.intel_false_flag} cost={t.intel_false_flag_cost} effect={t.intel_false_flag_eff}
            disabled={!canAct || !hasTarget || country.economy.budget < 12 || country.diplomaticInfluence < 8}
            onClick={() => act({ type: 'false_flag', targetCountry: targetCountryCode!, framedCountry: 'RU', operation: 'terrorist_attack' })} />
          <div className="mt-2 border-t border-border-default pt-2">
            <h5 className="text-xs font-bold uppercase text-severity-high mb-1">{t.intel_abduct_header}</h5>
            <ActionBtn label={t.intel_abduct_diplomat} cost={t.intel_abduct_diplomat_cost} effect={t.intel_abduct_diplomat_eff}
              disabled={!canAct || !hasTarget || !(country.tech?.researchedTechs ?? []).includes('intel_2')}
              onClick={() => act({ type: 'abduct_asset', targetCountry: targetCountryCode!, assetType: 'diplomat' })} />
            <ActionBtn label={t.intel_abduct_president} cost={t.intel_abduct_president_cost} effect={t.intel_abduct_president_eff}
              disabled={!canAct || !hasTarget || !(country.tech?.researchedTechs ?? []).includes('intel_3')}
              onClick={() => act({ type: 'abduct_asset', targetCountry: targetCountryCode!, assetType: 'president' })} />
          </div>
        </div>
      </div>

      {/* ── Smuggle section (shown when under sanctions or when target selected) ── */}
      {(hasSanctions || hasTarget) && (
        <div className="mt-3 border-t border-border-default pt-3">
          <h4 className="text-xs font-bold uppercase text-severity-high mb-2">{t.intel_smuggle_header}</h4>
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-16 shrink-0">{t.intel_smuggle_resource}</span>
                <select
                  value={smuggleRes}
                  onChange={e => setSmuggleRes(e.target.value as any)}
                  className="flex-1 text-xs bg-bg-card border border-border-default rounded px-1 py-0.5 text-text-primary"
                >
                  {smuggleResources.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-16 shrink-0">{t.intel_smuggle_method}</span>
                <select
                  value={smuggleMethod}
                  onChange={e => setSmuggleMethod(e.target.value as any)}
                  className="flex-1 text-xs bg-bg-card border border-border-default rounded px-1 py-0.5 text-text-primary"
                >
                  {smuggleMethods.map(m => (
                    <option key={m.key} value={m.key}>{m.label} ({m.risk})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <ActionBtn
                label={t.intel_smuggle_start}
                cost={t.intel_smuggle_cost}
                effect={t.intel_smuggle_eff.replace('{risk}', smuggleMethods.find(m => m.key === smuggleMethod)?.risk ?? '?')}
                disabled={!canAct || !hasTarget || country.economy.budget < 3}
                onClick={() => act({ type: 'smuggle', targetCountry: targetCountryCode!, resource: smuggleRes, amount: 10, method: smuggleMethod })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
