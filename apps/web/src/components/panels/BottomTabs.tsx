'use client';

import { useState } from 'react';
import type { CountryState, PlayerAction, DiplomaticRelation } from '@conflict-game/shared-types';
import { useLocaleStore } from '@/stores/localeStore';
import { TAB_KEYS, getTabLabel, type Tab, type TabProps } from './bottom-tabs/_shared';
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
  /** Country code of the target for diplomacy actions (the currently selected country on globe) */
  targetCountryCode?: string | null;
  /** The player's own country code */
  playerCountryCode?: string | null;
  /** Whether a game session is active */
  isGameActive?: boolean;
  /** Whether this country has active sanctions against it */
  hasSanctions?: boolean;
  /** All diplomatic relations in the game */
  relations?: DiplomaticRelation[];
  /** Current game tick */
  currentTick?: number;
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
}: BottomTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const { t } = useLocaleStore();

  // Can this player perform actions? Only on their own country during active game
  const isOwnCountry = playerCountryCode && country?.code === playerCountryCode;
  const canAct = isGameActive && isOwnCountry && !!onAction;

  return (
    <>
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
                />
              )
            ) : (
              <p className="text-text-muted text-sm">
                {t.bt_click_country_hint}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="h-10 bg-bg-secondary border-t border-border-default flex items-center px-4 shrink-0">
        <div className="flex gap-4">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(activeTab === tab ? null : tab)}
              className={`text-xs uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'text-accent-red font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {getTabLabel(t, tab)}
            </button>
          ))}
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
