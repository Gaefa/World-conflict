'use client';

interface HeaderProps {
  activeSessions: number;
  onlinePlayers: number;
  currentTick: number;
  isPaused: boolean;
  tensionIndex: number;
  onTogglePause?: () => void;
}

export function Header({
  activeSessions,
  onlinePlayers,
  currentTick,
  isPaused,
  tensionIndex,
  onTogglePause,
}: HeaderProps) {
  const tensionColor = tensionIndex > 70 ? 'text-severity-high' : tensionIndex > 40 ? 'text-amber-400' : 'text-accent-green';
  const tensionLabel = tensionIndex > 70 ? 'CRITICAL' : tensionIndex > 40 ? 'ELEVATED' : 'STABLE';

  return (
    <header className="h-12 bg-bg-secondary border-b border-border-default flex items-center px-4 shrink-0 z-50">
      <div className="flex items-center gap-2">
        <span className="text-accent-red font-bold text-lg tracking-widest">
          CONFLICT.GAME
        </span>
      </div>

      <div className="flex-1 flex justify-center gap-3">
        <Stat value={activeSessions} label="Active" icon="*" />
        <Stat value={onlinePlayers} label="Players" icon="@" />
        <div className="flex items-center gap-2 bg-bg-card px-3 py-1 rounded border border-border-default">
          <span className={`${tensionColor} font-mono text-sm font-bold`}>{tensionIndex.toFixed(0)}</span>
          <span className={`${tensionColor} text-xs uppercase`}>{tensionLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-bg-card px-3 py-1 rounded border border-border-default">
          <span className="text-text-primary text-sm font-mono">{tickToDate(currentTick)}</span>
          <span className="text-text-muted text-xs">Tick {currentTick}</span>
        </div>
        <button
          onClick={onTogglePause}
          className={`px-3 py-1 rounded text-sm font-bold uppercase tracking-wider transition-colors border ${
            isPaused
              ? 'bg-accent-green/20 text-accent-green border-accent-green/40 hover:bg-accent-green/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
          }`}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </header>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1 tick = 1 month. Game starts Jan 2026. */
function tickToDate(tick: number): string {
  const startYear = 2026;
  const totalMonths = tick;
  const year = startYear + Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  return `${MONTHS[month]} ${year}`;
}

function Stat({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 bg-bg-card px-3 py-1 rounded border border-border-default">
      <span className="text-text-muted text-xs">{icon}</span>
      <span className="text-text-primary font-mono text-sm font-bold">{value}</span>
      <span className="text-text-muted text-xs uppercase">{label}</span>
    </div>
  );
}
