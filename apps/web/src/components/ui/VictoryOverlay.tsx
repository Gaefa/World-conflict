'use client';

import { useLocaleStore } from '@/stores/localeStore';

interface VictoryOverlayProps {
  winner: string;
  winnerName: string;
  winnerFlag: string;
  condition: string;
  scores: { code: string; name: string; flag: string; indexOfPower: number }[];
  onClose: () => void;
}

export function VictoryOverlay({ winner, winnerName, winnerFlag, condition, scores, onClose }: VictoryOverlayProps) {
  const { t } = useLocaleStore();

  const conditionLabels: Record<string, string> = {
    domination: t.victory_domination,
    economic_hegemony: t.victory_economic,
    diplomatic: t.victory_diplomatic,
    technological: t.victory_technological,
    survival: t.victory_survival,
  };

  const sorted = [...scores].sort((a, b) => b.indexOfPower - a.indexOfPower);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85">
      <div className="bg-bg-secondary border-2 border-amber-500/50 rounded-xl p-8 w-full max-w-lg animate-fade-in text-center">
        {/* Trophy */}
        <div className="text-6xl mb-4">{'\uD83C\uDFC6'}</div>

        <h1 className="text-3xl font-bold text-amber-400 tracking-wider mb-2">
          {t.victory_title}
        </h1>

        <div className="text-5xl mb-2">{winnerFlag}</div>
        <h2 className="text-2xl font-bold text-text-primary mb-1">{winnerName}</h2>
        <p className="text-amber-400 text-sm uppercase tracking-wider mb-6">
          {conditionLabels[condition] || condition}
        </p>

        {/* Final standings */}
        <div className="bg-bg-card rounded-lg p-4 mb-6 text-left">
          <h3 className="text-xs font-bold uppercase text-text-muted mb-2">{t.leaderboard_title}</h3>
          <div className="space-y-1">
            {sorted.slice(0, 5).map((s, i) => (
              <div
                key={s.code}
                className={`flex items-center gap-2 py-1 px-2 rounded ${s.code === winner ? 'bg-amber-500/10' : ''}`}
              >
                <span className="text-text-muted font-mono w-5 text-right">{i + 1}.</span>
                <span>{s.flag}</span>
                <span className={`flex-1 text-sm ${s.code === winner ? 'text-amber-400 font-bold' : 'text-text-primary'}`}>
                  {s.name}
                </span>
                <span className="font-mono text-sm text-text-secondary">{s.indexOfPower.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="bg-accent-red hover:bg-red-600 text-white px-8 py-2 rounded font-bold uppercase tracking-wider transition-colors"
        >
          {t.victory_close}
        </button>
      </div>
    </div>
  );
}
