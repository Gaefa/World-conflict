'use client';

interface HeaderProps {
  activeSessions: number;
  onlinePlayers: number;
  currentTick: number;
  isPaused: boolean;
  onTogglePause?: () => void;
}

export function Header({
  activeSessions,
  onlinePlayers,
  currentTick,
  isPaused,
  onTogglePause,
}: HeaderProps) {
  return (
    <header className="h-12 bg-bg-secondary border-b border-border-default flex items-center px-4 shrink-0 z-50">
      <div className="flex items-center gap-2">
        <span className="text-accent-red font-bold text-lg tracking-widest">
          CONFLICT.GAME
        </span>
      </div>

      <div className="flex-1 flex justify-center gap-4">
        <Stat value={activeSessions} label="Active" color="text-accent-red" />
        <Stat value={onlinePlayers} label="Players" color="text-text-primary" />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-text-muted text-sm font-mono">{tickToDate(currentTick)}</span>
        <button
          onClick={onTogglePause}
          className="text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          {isPaused ? '▶' : '⏸'}
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

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 bg-bg-card px-3 py-1 rounded border border-border-default">
      <span className={`${color} font-mono text-xl font-bold`}>{value}</span>
      <span className="text-text-muted text-xs uppercase">{label}</span>
    </div>
  );
}
