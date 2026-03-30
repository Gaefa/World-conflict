'use client';

import { useState } from 'react';

interface CountryStats {
  name: string;
  code: string;
  gdp: number;
  population: number;
  militaryPower: number;
  stability: number;
  techLevel: number;
  powerIndex: number;
  isNonPlayable?: boolean;
}

interface CountryPanelProps {
  country: CountryStats | null;
}

export function CountryPanel({ country }: CountryPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`bg-bg-secondary border-l border-border-default flex flex-col shrink-0 transition-all duration-300 ${
        collapsed ? 'w-10' : 'w-80'
      }`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-b border-border-default flex items-center gap-2 hover:bg-bg-hover transition-colors"
      >
        {!collapsed && (
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex-1 text-left">
            {country ? country.name : 'Select Country'}
          </h2>
        )}
        <span className="text-text-muted text-xs">{collapsed ? '◀' : '▶'}</span>
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3">
          {!country ? (
            <div className="text-text-muted text-sm text-center py-8">
              Click a country on the globe.
            </div>
          ) : country.isNonPlayable ? (
            <div className="space-y-3">
              <div className="text-center py-4">
                <p className="text-text-primary text-lg font-bold">{country.name}</p>
                <p className="text-text-muted text-xs font-mono mt-1">{country.code}</p>
              </div>
              <div className="bg-bg-card border border-border-default rounded p-3">
                <p className="text-text-secondary text-sm">
                  Non-playable territory. Can be targeted by diplomacy, military, or intelligence actions.
                </p>
              </div>
              <div className="space-y-1">
                <ActionHint label="Declare War" desc="Conquer and annex" />
                <ActionHint label="Impose Sanctions" desc="Reduce their economy" />
                <ActionHint label="Spy" desc="Gather intelligence" />
                <ActionHint label="Trade Agreement" desc="Boost your GDP" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center pb-2">
                <p className="text-text-muted text-xs font-mono">{country.code}</p>
              </div>
              <StatBar label="Power Index" value={country.powerIndex} max={100} color="bg-accent-red" />
              <StatBar label="GDP" value={country.gdp / 1e12} max={25} color="bg-accent-green" suffix="T$" />
              <StatBar label="Military" value={country.militaryPower} max={100} color="bg-accent-amber" />
              <StatBar label="Stability" value={country.stability} max={100} color="bg-accent-blue" />
              <StatBar label="Tech Level" value={country.techLevel} max={10} color="bg-purple-500" />

              <div className="border-t border-border-default pt-3 mt-3">
                <p className="text-text-muted text-xs mb-1">Population</p>
                <p className="text-text-primary font-mono text-sm">
                  {country.population > 0 ? `${(country.population / 1e6).toFixed(1)}M` : 'Unknown'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function StatBar({
  label,
  value,
  max,
  color,
  suffix = '',
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-mono">
          {value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="h-1.5 bg-bg-card rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ActionHint({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="bg-bg-card border border-border-default rounded p-2 flex justify-between items-center">
      <span className="text-text-primary text-sm">{label}</span>
      <span className="text-text-muted text-xs">{desc}</span>
    </div>
  );
}
