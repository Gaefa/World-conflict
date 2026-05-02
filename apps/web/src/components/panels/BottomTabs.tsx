'use client';

import { useState, useEffect } from 'react';
import type { CountryState, PlayerAction, DiplomaticRelation, Army } from '@conflict-game/shared-types';
import { useLocaleStore } from '@/stores/localeStore';
import {
  PRIMARY_TABS, SECONDARY_TABS, getTabLabel,
  type Tab, type TabProps,
} from './bottom-tabs/_shared';
import { EconomyTab } from './bottom-tabs/EconomyTab';
import { MilitaryTab } from './bottom-tabs/MilitaryTab';
import { DiplomacyTab } from './bottom-tabs/DiplomacyTab';
import { IntelligenceTab } from './bottom-tabs/IntelligenceTab';
import { ResearchTab } from './bottom-tabs/ResearchTab';
import { DomesticTab } from './bottom-tabs/DomesticTab';

interface BottomTabsProps {
  country: CountryState | null;
  isNonPlayable?: boolean;
  countryName?: string;
  onAction?: (action: PlayerAction) => void;
  targetCountryCode?: string | null;
  playerCountryCode?: string | null;
  isGameActive?: boolean;
  hasSanctions?: boolean;
  relations?: DiplomaticRelation[];
  currentTick?: number;
  armies?: Army[];
  allCountries?: Record<string, CountryState>;
  warCountries?: Set<string>;
}

export function BottomTabs({
  country,
  isNonPlayable,
  countryName,
  onAction,
  targetCountryCode,
  playerCountryCode,
  isGameActive,
  hasSanctions,
  relations,
  currentTick,
  armies,
  allCountries,
  warCountries,
}: BottomTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [showSecondary, setShowSecondary] = useState(false);
  const { t } = useLocaleStore();

  const isAtWar = (warCountries?.size ?? 0) > 0;

  // Auto-open Military tab when war starts
  useEffect(() => {
    if (isAtWar && isGameActive) {
      setActiveTab('Military');
    }
  }, [isAtWar, isGameActive]);

  const canAct = isGameActive && playerCountryCode && country?.code === playerCountryCode && !!onAction;

  const warEnemies = warCountries ? [...warCountries].join(', ') : '';

  const tabRow = (tabs: Tab[]) => tabs.map((tab) => (
    <button
      key={tab}
      onClick={() => { setActiveTab(activeTab === tab ? null : tab); setShowSecondary(false); }}
      className={`text-xs uppercase tracking-wider transition-colors ${
        activeTab === tab
          ? 'text-accent-red font-bold'
          : tab === 'Military' && isAtWar
          ? 'text-severity-high font-bold animate-pulse'
          : 'text-text-muted hover:text-text-primary'
      }`}
    >
      {tab === 'Military' && isAtWar ? `⚔ ${getTabLabel(t, tab)}` : getTabLabel(t, tab)}
    </button>
  ));

  return (
    <>
      {/* War mode banner */}
      {isAtWar && isGameActive && (
        <div className="bg-severity-high/10 border-t border-severity-high/40 px-4 py-1.5 flex items-center gap-3 shrink-0">
          <span className="text-severity-high font-bold text-xs uppercase tracking-wider animate-pulse">
            ⚔ {t.war_mode_banner ?? 'WAR MODE'}
          </span>
          <span className="text-text-muted text-xs">
            {t.war_mode_against ?? 'At war with'}: <span className="text-severity-high font-mono">{warEnemies}</span>
          </span>
          <span className="ml-auto text-text-muted text-[10px]">
            {t.war_mode_tip ?? 'Military tab → Map for battle orders'}
          </span>
        </div>
      )}

      {/* Panel content */}
      {activeTab && (
        <div className="h-64 bg-bg-secondary border-t border-border-default animate-slide-up overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                {getTabLabel(t, activeTab)}
                {country && (
                  <span className="ml-2 text-text-muted font-normal">— {countryName || country.code}</span>
                )}
              </h3>
              <button
                onClick={() => setActiveTab(null)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>
            {country ? (
              isNonPlayable ? (
                <div className="text-text-muted text-sm">
                  <p className="mb-2">{countryName || country.code} — {t.bt_nonplayable_line1}</p>
                  <p>{t.bt_nonplayable_line2}</p>
                </div>
              ) : (
                <TabContent
                  tab={activeTab}
                  country={country}
                  canAct={!!canAct}
                  onAction={onAction}
                  targetCountryCode={targetCountryCode}
                  playerCountryCode={playerCountryCode}
                  hasSanctions={hasSanctions}
                  relations={relations}
                  currentTick={currentTick}
                  armies={armies}
                  allCountries={allCountries}
                  warCountries={warCountries}
                />
              )
            ) : (
              <p className="text-text-muted text-sm">{t.bt_click_country_hint}</p>
            )}
          </div>
        </div>
      )}

      {/* Tab bar — primary tabs + expandable secondary */}
      <div className="h-10 bg-bg-secondary border-t border-border-default flex items-center px-4 shrink-0">
        <div className="flex gap-4 items-center">
          {tabRow(PRIMARY_TABS)}

          {/* Divider */}
          <span className="text-border-default text-xs select-none">|</span>

          {/* Secondary tabs (collapsed by default) */}
          {showSecondary ? (
            <>
              {tabRow(SECONDARY_TABS)}
              <button
                onClick={() => setShowSecondary(false)}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                ‹ {t.war_mode_less ?? 'Less'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowSecondary(true)}
              className="text-xs text-text-muted hover:text-text-primary tracking-wider"
            >
              {t.war_mode_more ?? '••• More'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function TabContent({ tab, ...props }: TabProps & { tab: Tab }) {
  switch (tab) {
    case 'Economy':
      return <EconomyTab {...props} />;
    case 'Military':
      return <MilitaryTab {...props} />;
    case 'Diplomacy':
      return <DiplomacyTab {...props} />;
    case 'Intelligence':
      return <IntelligenceTab {...props} />;
    case 'Research':
      return <ResearchTab {...props} />;
    case 'Domestic':
      return <DomesticTab {...props} />;
  }
}
