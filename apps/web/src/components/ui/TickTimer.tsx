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
  // Single counter to trigger re-renders; actual values are computed during render.
  const [, setFrame] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPaused || lastTickAt === 0) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const animate = () => {
      const elapsed = Date.now() - lastTickAt;
      if (elapsed < tickDurationMs) {
        // Still counting down — schedule next frame
        setFrame(f => f + 1);
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Tick has passed — one final render and stop
        setFrame(f => f + 1);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [lastTickAt, tickDurationMs, isPaused]);

  // Compute display values during render — no separate state needed.
  const elapsed = isPaused || lastTickAt === 0 ? 0 : Date.now() - lastTickAt;
  const progress = Math.min(elapsed / tickDurationMs, 1);
  const secs = Math.ceil(Math.max(0, tickDurationMs - elapsed) / 1000);

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
