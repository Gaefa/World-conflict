'use client';

import { useState } from 'react';
import type { PlayerAction } from '@conflict-game/shared-types';
import { useLocaleStore } from '@/stores/localeStore';
import type { Translations } from '@/lib/i18n/types';
import { type TabProps } from './_shared';

// ── Tech Tree UI constants (inlined for Turbopack compat) ──

type TechBranchKey = 'military' | 'economic' | 'cyber' | 'space' | 'biotech' | 'infrastructure';

function getBranchMeta(t: Translations): { key: TechBranchKey; label: string; icon: string }[] {
  return [
    { key: 'military', label: t.research_branch_military, icon: '\u2694\uFE0F' },
    { key: 'economic', label: t.research_branch_economic, icon: '\u{1F4B0}' },
    { key: 'cyber', label: t.research_branch_cyber, icon: '\u{1F4BB}' },
    { key: 'space', label: t.research_branch_space, icon: '\u{1F680}' },
    { key: 'biotech', label: t.research_branch_biotech, icon: '\u{1F9EC}' },
    { key: 'infrastructure', label: t.research_branch_infra, icon: '\u{1F3D7}\uFE0F' },
  ];
}

interface TechDefUI { id: string; branch: TechBranchKey; tier: number; name: string; icon: string; cost: number; researchTicks: number; prerequisites: string[]; effectDesc: string[] }

const TECH_TREE_UI: TechDefUI[] = [
  // Military
  { id: 'mil_1', branch: 'military', tier: 1, name: 'Advanced Infantry', icon: '\u{1F3AF}', cost: 5, researchTicks: 3, prerequisites: [], effectDesc: ['Attack +10%'] },
  { id: 'mil_2', branch: 'military', tier: 2, name: 'Mechanized Warfare', icon: '\u{1F69C}', cost: 10, researchTicks: 5, prerequisites: ['mil_1'], effectDesc: ['Attack +15%', 'Defense +10%'] },
  { id: 'mil_3', branch: 'military', tier: 3, name: 'Drone Warfare', icon: '\u{1F681}', cost: 15, researchTicks: 6, prerequisites: ['mil_2'], effectDesc: ['Attack +20%', 'Intel +2'] },
  { id: 'mil_4', branch: 'military', tier: 4, name: 'Hypersonic Missiles', icon: '\u{1F680}', cost: 25, researchTicks: 8, prerequisites: ['mil_3'], effectDesc: ['Attack +25%'] },
  { id: 'mil_5', branch: 'military', tier: 5, name: 'Stealth Technology', icon: '\u{1F47B}', cost: 30, researchTicks: 10, prerequisites: ['mil_4', 'cyber_2'], effectDesc: ['Defense +20%', 'Attack +15%'] },
  { id: 'mil_6', branch: 'military', tier: 6, name: 'Naval Supremacy', icon: '\u2693', cost: 35, researchTicks: 12, prerequisites: ['mil_5'], effectDesc: ['Attack +15%', 'Trade +10%'] },
  { id: 'mil_7', branch: 'military', tier: 7, name: 'Strategic Bombers', icon: '\u2708\uFE0F', cost: 40, researchTicks: 14, prerequisites: ['mil_6'], effectDesc: ['Attack +30%'] },
  { id: 'mil_8', branch: 'military', tier: 8, name: 'Nuclear Deterrent', icon: '\u2622\uFE0F', cost: 50, researchTicks: 18, prerequisites: ['mil_7', 'infra_4'], effectDesc: ['Defense +30%', 'Stability +0.5/tick'] },
  // Economic
  { id: 'econ_1', branch: 'economic', tier: 1, name: 'Digital Banking', icon: '\u{1F4B3}', cost: 5, researchTicks: 3, prerequisites: [], effectDesc: ['GDP +0.3%'] },
  { id: 'econ_2', branch: 'economic', tier: 2, name: 'Trade Automation', icon: '\u{1F4E6}', cost: 8, researchTicks: 4, prerequisites: ['econ_1'], effectDesc: ['Trade +15%'] },
  { id: 'econ_3', branch: 'economic', tier: 3, name: 'Special Economic Zones', icon: '\u{1F3ED}', cost: 12, researchTicks: 5, prerequisites: ['econ_2'], effectDesc: ['GDP +0.5%', 'Trade +10%'] },
  { id: 'econ_4', branch: 'economic', tier: 4, name: 'Green Energy', icon: '\u{1F33F}', cost: 20, researchTicks: 8, prerequisites: ['econ_3', 'infra_2'], effectDesc: ['Energy +20%', 'Stability +0.3/tick'] },
  { id: 'econ_5', branch: 'economic', tier: 5, name: 'Advanced Manufacturing', icon: '\u2699\uFE0F', cost: 25, researchTicks: 10, prerequisites: ['econ_4'], effectDesc: ['Industrial +25%', 'Unlocks weapons'] },
  { id: 'econ_6', branch: 'economic', tier: 6, name: 'Financial Instruments', icon: '\u{1F4C8}', cost: 30, researchTicks: 12, prerequisites: ['econ_5'], effectDesc: ['GDP +0.8%', 'Sanction res. +15'] },
  // Cyber
  { id: 'cyber_1', branch: 'cyber', tier: 1, name: 'Basic Encryption', icon: '\u{1F510}', cost: 5, researchTicks: 3, prerequisites: [], effectDesc: ['Counter-intel +5'] },
  { id: 'cyber_2', branch: 'cyber', tier: 2, name: 'Network Defense', icon: '\u{1F6E1}\uFE0F', cost: 10, researchTicks: 5, prerequisites: ['cyber_1'], effectDesc: ['Counter-intel +10', 'Cyber def +15%'] },
  { id: 'cyber_3', branch: 'cyber', tier: 3, name: 'Offensive Cyber', icon: '\u{1F5A5}\uFE0F', cost: 15, researchTicks: 7, prerequisites: ['cyber_2'], effectDesc: ['Unlocks cyber attacks', 'Cyber +3'] },
  { id: 'cyber_4', branch: 'cyber', tier: 4, name: 'AI Surveillance', icon: '\u{1F916}', cost: 20, researchTicks: 8, prerequisites: ['cyber_3'], effectDesc: ['Intel +5 per op', 'Cyber +3'] },
  { id: 'cyber_5', branch: 'cyber', tier: 5, name: 'Quantum Computing', icon: '\u{1F52E}', cost: 35, researchTicks: 12, prerequisites: ['cyber_4', 'econ_5'], effectDesc: ['Cyber +5', 'Intel +5', 'GDP +0.3%'] },
  { id: 'cyber_6', branch: 'cyber', tier: 6, name: 'Full Spectrum Cyber', icon: '\u26A1', cost: 45, researchTicks: 15, prerequisites: ['cyber_5'], effectDesc: ['Cyber +5', 'CI +15', 'Full cyber war'] },
  // Space
  { id: 'space_1', branch: 'space', tier: 1, name: 'Satellite Launch', icon: '\u{1F6F0}\uFE0F', cost: 10, researchTicks: 5, prerequisites: [], effectDesc: ['Intel +2'] },
  { id: 'space_2', branch: 'space', tier: 2, name: 'GPS Network', icon: '\u{1F4E1}', cost: 15, researchTicks: 6, prerequisites: ['space_1'], effectDesc: ['Accuracy +10%', 'Trade +5%'] },
  { id: 'space_3', branch: 'space', tier: 3, name: 'Space Reconnaissance', icon: '\u{1F52D}', cost: 20, researchTicks: 8, prerequisites: ['space_2'], effectDesc: ['Intel +5', 'Better sat ops'] },
  { id: 'space_4', branch: 'space', tier: 4, name: 'Anti-Satellite Weapons', icon: '\u{1F4A5}', cost: 30, researchTicks: 10, prerequisites: ['space_3', 'mil_4'], effectDesc: ['ASAT capability', 'Attack +15%'] },
  { id: 'space_5', branch: 'space', tier: 5, name: 'Space Station', icon: '\u{1F30D}', cost: 40, researchTicks: 14, prerequisites: ['space_4'], effectDesc: ['GDP +0.5%', 'Stability +0.5', 'Intel +3'] },
  // Biotech
  { id: 'bio_1', branch: 'biotech', tier: 1, name: 'Genetic Research', icon: '\u{1F9EC}', cost: 8, researchTicks: 4, prerequisites: [], effectDesc: ['Stability +0.2/tick'] },
  { id: 'bio_2', branch: 'biotech', tier: 2, name: 'Vaccine Programs', icon: '\u{1F489}', cost: 10, researchTicks: 5, prerequisites: ['bio_1'], effectDesc: ['Stability +0.3/tick', 'Approval +5'] },
  { id: 'bio_3', branch: 'biotech', tier: 3, name: 'Biodefense', icon: '\u{1F9EA}', cost: 15, researchTicks: 7, prerequisites: ['bio_2'], effectDesc: ['Bio defense +20%', 'Stability +0.2'] },
  { id: 'bio_4', branch: 'biotech', tier: 4, name: 'Agricultural Biotech', icon: '\u{1F33E}', cost: 18, researchTicks: 6, prerequisites: ['bio_3'], effectDesc: ['Food +30%', 'Better fertilizer'] },
  { id: 'bio_5', branch: 'biotech', tier: 5, name: 'Synthetic Biology', icon: '\u{1F52C}', cost: 35, researchTicks: 12, prerequisites: ['bio_4', 'cyber_4'], effectDesc: ['Pharma unlocked', 'GDP +0.5%', 'Industrial +15%'] },
  // Infrastructure
  { id: 'infra_1', branch: 'infrastructure', tier: 1, name: 'Power Grid', icon: '\u{1F50C}', cost: 8, researchTicks: 4, prerequisites: [], effectDesc: ['Energy +15%', 'GDP +0.2%'] },
  { id: 'infra_2', branch: 'infrastructure', tier: 2, name: 'Highway Network', icon: '\u{1F6E3}\uFE0F', cost: 12, researchTicks: 5, prerequisites: ['infra_1'], effectDesc: ['Trade +10%', 'GDP +0.3%'] },
  { id: 'infra_3', branch: 'infrastructure', tier: 3, name: '5G Deployment', icon: '\u{1F4F6}', cost: 15, researchTicks: 6, prerequisites: ['infra_2'], effectDesc: ['GDP +0.4%', 'Cyber +2'] },
  { id: 'infra_4', branch: 'infrastructure', tier: 4, name: 'Smart Cities', icon: '\u{1F3D9}\uFE0F', cost: 25, researchTicks: 8, prerequisites: ['infra_3', 'cyber_3'], effectDesc: ['Stability +0.4', 'GDP +0.5%', 'Approval +5'] },
  { id: 'infra_5', branch: 'infrastructure', tier: 5, name: 'Underground Bunkers', icon: '\u{1F3DA}\uFE0F', cost: 30, researchTicks: 10, prerequisites: ['infra_4'], effectDesc: ['Civilian def +25%', 'Stability +0.3'] },
  { id: 'infra_6', branch: 'infrastructure', tier: 6, name: 'Logistics Networks', icon: '\u{1F4E6}', cost: 35, researchTicks: 12, prerequisites: ['infra_5', 'econ_5'], effectDesc: ['All resources +15%', 'Trade +15%', 'Sanction res. +10'] },
];

export function ResearchTab({ country, canAct, onAction }: TabProps) {
  const { t, tech: techTranslations } = useLocaleStore();
  const [selectedBranch, setSelectedBranch] = useState<TechBranchKey>('military');
  const countryTech = country.tech;
  const researched = countryTech?.researchedTechs ?? [];
  const activeResearch = countryTech?.activeResearch;
  const branchMeta = getBranchMeta(t);

  const act = (action: PlayerAction) => {
    if (canAct && onAction) onAction(action);
  };

  const branchTechs = TECH_TREE_UI.filter(td => td.branch === selectedBranch).sort((a, b) => a.tier - b.tier);
  const totalResearched = researched.length;

  const getTechStatus = (td: TechDefUI): 'completed' | 'researching' | 'available' | 'locked' => {
    if (researched.includes(td.id)) return 'completed';
    if (activeResearch?.techId === td.id) return 'researching';
    if (td.prerequisites.every(p => researched.includes(p))) return 'available';
    return 'locked';
  };

  const getTechName = (td: TechDefUI): string => {
    return techTranslations[td.id]?.name ?? td.name;
  };

  const getTechEffects = (td: TechDefUI): string[] => {
    return techTranslations[td.id]?.effects ?? td.effectDesc;
  };

  return (
    <div>
      {/* Active research banner */}
      {activeResearch && (
        <div className="bg-accent-amber/10 border border-accent-amber/30 rounded p-2 mb-3 flex items-center justify-between">
          <div>
            <span className="text-accent-amber text-xs font-bold uppercase">{t.research_active_prefix} </span>
            <span className="text-text-primary text-sm font-bold">
              {(() => { const td = TECH_TREE_UI.find(td => td.id === activeResearch.techId); return td ? getTechName(td) : activeResearch.techId; })()}
            </span>
            <span className="text-text-muted text-xs ml-2">
              {t.research_months_remaining_fmt.replace('{rem}', String(activeResearch.ticksRemaining)).replace('{total}', String(activeResearch.totalTicks))}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-bg-card rounded-full overflow-hidden">
              <div className="h-full bg-accent-amber rounded-full transition-all"
                style={{ width: `${((activeResearch.totalTicks - activeResearch.ticksRemaining) / activeResearch.totalTicks) * 100}%` }} />
            </div>
            <button disabled={!canAct}
              onClick={() => act({ type: 'cancel_research' })}
              className={`text-xs px-2 py-0.5 rounded border border-severity-high/50 text-severity-high ${!canAct ? 'opacity-50' : 'hover:bg-severity-high/20 cursor-pointer'}`}>
              {t.research_cancel_btn}
            </button>
          </div>
        </div>
      )}

      {/* Branch selector */}
      <div className="flex gap-1 mb-3">
        {branchMeta.map(b => {
          const branchTechIds = TECH_TREE_UI.filter(td => td.branch === b.key);
          const done = branchTechIds.filter(td => researched.includes(td.id)).length;
          return (
            <button key={b.key} onClick={() => setSelectedBranch(b.key)}
              className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                selectedBranch === b.key
                  ? 'border-accent-red bg-accent-red/20 text-accent-red font-bold'
                  : 'border-border-default text-text-muted hover:text-text-primary'
              }`}>
              {b.icon} {b.label}
              <span className="ml-1 text-text-muted">{done}/{branchTechIds.length}</span>
            </button>
          );
        })}
      </div>

      {/* Stats bar */}
      <div className="flex justify-between text-xs text-text-muted mb-2">
        <span>{t.research_total_count_fmt.replace('{done}', String(totalResearched)).replace('{total}', String(TECH_TREE_UI.length))}</span>
        <span>{t.research_tech_level_fmt.replace('{lvl}', country.techLevel.toFixed(0))}</span>
      </div>

      {/* Tech list for selected branch */}
      <div className="space-y-1.5">
        {branchTechs.map(td => {
          const status = getTechStatus(td);
          const canStart = status === 'available' && !activeResearch && canAct && country.economy.budget >= td.cost;
          const missingPrereqs = td.prerequisites.filter(p => !researched.includes(p));

          return (
            <div key={td.id} className={`flex items-center gap-2 border rounded p-2 transition-colors ${
              status === 'completed' ? 'border-accent-green/40 bg-accent-green/5' :
              status === 'researching' ? 'border-accent-amber/40 bg-accent-amber/5 animate-pulse' :
              status === 'available' ? 'border-border-default bg-bg-card' :
              'border-border-default/50 bg-bg-card/50 opacity-60'
            }`}>
              <span className="text-lg">{td.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${status === 'completed' ? 'text-accent-green' : status === 'researching' ? 'text-accent-amber' : 'text-text-primary'}`}>
                    {getTechName(td)}
                  </span>
                  {status === 'completed' && <span className="text-accent-green text-xs">{'\u2713'}</span>}
                  {status === 'researching' && <span className="text-accent-amber text-xs">...</span>}
                  {status === 'locked' && missingPrereqs.length > 0 && (
                    <span className="text-text-muted text-xs">
                      {t.research_needs_prefix} {missingPrereqs.map(p => { const prereq = TECH_TREE_UI.find(x => x.id === p); return prereq ? getTechName(prereq) : p; }).join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted truncate">
                  {getTechEffects(td).join(' \u2022 ')}
                </div>
              </div>
              <div className="text-right shrink-0">
                {status === 'completed' ? (
                  <span className="text-accent-green text-xs font-bold">{t.research_done}</span>
                ) : status === 'researching' ? (
                  <span className="text-accent-amber text-xs">{activeResearch?.ticksRemaining}mo</span>
                ) : (
                  <div className="text-right">
                    <div className="text-xs text-accent-amber">${td.cost}B</div>
                    <div className="text-xs text-text-muted">{td.researchTicks}mo</div>
                  </div>
                )}
              </div>
              {canStart && (
                <button onClick={() => act({ type: 'research_tech', techId: td.id })}
                  className="text-xs px-2 py-1 rounded bg-accent-red/20 border border-accent-red/50 text-accent-red hover:bg-accent-red/30 cursor-pointer shrink-0">
                  {t.research_start_btn}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
