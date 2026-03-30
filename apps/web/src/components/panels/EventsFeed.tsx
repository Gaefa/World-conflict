'use client';

import { useState } from 'react';

interface GameEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tick: number;
}

const SEVERITY_STYLES = {
  low: 'border-l-accent-blue text-accent-blue',
  medium: 'border-l-accent-amber text-accent-amber',
  high: 'border-l-severity-high text-severity-high',
  critical: 'border-l-severity-critical text-severity-critical',
} as const;

interface EventsFeedProps {
  events: GameEvent[];
}

export function EventsFeed({ events }: EventsFeedProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`bg-bg-secondary border-r border-border-default flex flex-col shrink-0 transition-all duration-300 ${
        collapsed ? 'w-10' : 'w-80'
      }`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-b border-border-default flex items-center gap-2 hover:bg-bg-hover transition-colors"
      >
        <span className="text-text-muted text-xs">{collapsed ? '▶' : '◀'}</span>
        {!collapsed && (
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
            Events Feed
          </h2>
        )}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {events.length === 0 ? (
            <div className="text-text-muted text-sm text-center py-8">
              No events yet. Start a game session to begin.
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={`bg-bg-card border-l-2 ${SEVERITY_STYLES[event.severity]} p-2 rounded-r text-xs animate-fade-in`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-text-primary">{event.title}</span>
                  <span className="text-text-muted font-mono">T{event.tick}</span>
                </div>
                <p className="text-text-secondary">{event.description}</p>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
