'use client';

import { useLocaleStore } from '@/stores/localeStore';

interface LeaderboardEntry {
  code: string;
  name: string;
  flag: string;
  indexOfPower: number;
  gdp: number;
  military: number;
  isPlayer: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  const { t } = useLocaleStore();

  const sorted = [...entries].sort((a, b) => b.indexOfPower - a.indexOfPower);
  const top10 = sorted.slice(0, 10);

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg p-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
        {t.leaderboard_title}
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-muted border-b border-border-default">
            <th className="text-left py-1 w-8">#</th>
            <th className="text-left py-1">{t.leaderboard_country}</th>
            <th className="text-right py-1">{t.leaderboard_power}</th>
            <th className="text-right py-1">{t.leaderboard_gdp}</th>
          </tr>
        </thead>
        <tbody>
          {top10.map((entry, i) => (
            <tr
              key={entry.code}
              className={`border-b border-border-default/30 ${entry.isPlayer ? 'bg-accent-red/10' : ''}`}
            >
              <td className="py-1.5 font-mono font-bold text-text-muted">{i + 1}</td>
              <td className="py-1.5">
                <span className="mr-1">{entry.flag}</span>
                <span className={entry.isPlayer ? 'text-accent-red font-bold' : 'text-text-primary'}>
                  {entry.name}
                </span>
              </td>
              <td className="py-1.5 text-right font-mono">
                <span className={
                  i === 0 ? 'text-amber-400' : i === 1 ? 'text-text-secondary' : i === 2 ? 'text-amber-700' : 'text-text-muted'
                }>
                  {entry.indexOfPower.toFixed(1)}
                </span>
              </td>
              <td className="py-1.5 text-right font-mono text-text-muted">
                ${(entry.gdp / 1000).toFixed(1)}T
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
