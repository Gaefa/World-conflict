'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useLocaleStore } from '@/stores/localeStore';

export function ActionToast() {
  const lastActionResult = useGameStore((s) => s.lastActionResult);
  const { t } = useLocaleStore();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(lastActionResult);

  useEffect(() => {
    if (lastActionResult && lastActionResult !== current) {
      setCurrent(lastActionResult);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [lastActionResult, current]);

  if (!visible || !current) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-slide-up">
      <div
        className={`rounded border px-4 py-3 shadow-lg max-w-md ${
          current.success
            ? 'bg-bg-secondary border-accent-green/50'
            : 'bg-bg-secondary border-severity-high/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-bold ${current.success ? 'text-accent-green' : 'text-severity-high'}`}>
            {current.success ? t.toast_ok : t.toast_failed}
          </span>
          <span className="text-text-primary text-sm">{current.message}</span>
          <button
            onClick={() => setVisible(false)}
            className="ml-auto text-text-muted hover:text-text-primary text-xs"
          >
            ✕
          </button>
        </div>
        {current.effects.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {current.effects.map((e, i) => (
              <span
                key={i}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  e.known
                    ? 'bg-bg-card text-text-secondary'
                    : 'bg-bg-card text-text-muted italic'
                }`}
              >
                {e.known ? e.description : '???'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
