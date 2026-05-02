'use client';

import { useEffect, useRef, useState } from 'react';

interface TickTimerProps {
  tickDurationMs: number;
  lastTickAt: number;
  isPaused: boolean;
}

/**
 * Thin progress bar + countdown that shows time until the next game tick.
 * Resets automatically whenever `lastTickAt` changes (new tick arrived).
 */
export function TickTimer({ tickDurationMs, lastTickAt, isPaused }: TickTimerProps) {
  const [progress, setProgress] = useState(0); // 0→1
  const [remaining, setRemaining] = useState(tickDurationMs);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPaused || lastTickAt === 0) {
      setProgress(0);
      setRemaining(tickDurationMs);
      return;
    }

    const animate = () => {
      const elapsed = Date.now() - lastTickAt;
      const p = Math.min(elapsed / tickDurationMs, 1);
      setProgress(p);
      setRemaining(Math.max(0, tickDurationMs - elapsed));
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [lastTickAt, tickDurationMs, isPaused]);

  const secs = Math.ceil(remaining / 1000);

  // Color: green → amber → red as tick approaches
  const barColor = progress < 0.6 ? '#22c55e' : progress < 0.85 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2" title={`Next tick in ~${secs}s`}>
      {/* Countdown digits */}
      <span className="font-mono text-xs text-text-muted tabular-nums w-5 text-right">
        {isPaused ? '—' : secs}
      </span>
      {/* Bar */}
      <div className="relative w-20 h-1.5 bg-bg-card rounded-full overflow-hidden border border-border-default">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-none"
          style={{ width: `${progress * 100}%`, background: barColor }}
        />
      </div>
      {/* War indicator badge */}
      {tickDurationMs > 10_000 && !isPaused && (
        <span className="text-[9px] text-accent-red font-bold uppercase tracking-wider">
          ⚔
        </span>
      )}
    </div>
  );
}
